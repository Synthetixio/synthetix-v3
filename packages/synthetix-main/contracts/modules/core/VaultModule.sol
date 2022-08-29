//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/FundMixin.sol";

import "../../utils/SharesLibrary.sol";

import "../../storage/FundVaultStorage.sol";
import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

import "../../submodules/FundEventAndErrors.sol";

contract VaultModule is
    IVaultModule,
    FundVaultStorage,
    FundEventAndErrors,
    AccountRBACMixin,
    OwnableMixin,
    AssociatedSystemsMixin,
    FundMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    using SharesLibrary for SharesLibrary.Distribution;

    bytes32 private constant _USD_TOKEN = "USDToken";

    error InvalidLeverage(uint leverage);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDebt(int currentDebt);

    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    )
        external
        override
        onlyWithPermission(accountId, _ASSIGN_PERMISSION)
        collateralEnabled(collateralType)
        fundExists(fundId)
    {
        // Fix leverage to 1 until it's enabled
        // TODO: we will probably at least want to test <1 leverage
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        _updateAvailableRewards(epochData, vaultData.rewards, accountId);

        // get the current collateral situation
        (uint oldCollateralAmount, , ) = _accountCollateral(accountId, fundId, collateralType);

        // if increasing collateral additionally check they have enough collateral
        if (
            collateralAmount > oldCollateralAmount &&
            _getAccountUnassignedCollateral(accountId, collateralType) < collateralAmount - oldCollateralAmount
        ) {
            revert InsufficientAccountCollateral(accountId, collateralType, collateralAmount);
        }

        bytes32 actorId = bytes32(accountId);

        // stack too deep after this
        {
            // if decreasing collateral additionally check they have sufficient c-ratio

            _distributeVaultDebt(fundId, collateralType);

            uint debtShares = _calculateDebtShares(epochData, collateralAmount, leverage);

            // prevent users from specifying an infitesimly small amount such that they don't get any shares
            if (debtShares == 0 && collateralAmount > 0) {
                revert InvalidParameters("amount", "must be large enough for 1 share");
            }

            epochData.collateralDist.updateActorValue(actorId, int(collateralAmount));
            epochData.debtDist.updateActorShares(actorId, debtShares);
            // no update for usd because no usd issued

            // this will ensure the new distribution information is passed up the chain to the markets
            _updateAccountDebt(accountId, fundId, collateralType);
        }

        // this is the most efficient time to check the resulting collateralization ratio, since
        // user's debt and collateral price have been fully updated
        if (collateralAmount < oldCollateralAmount) {
            int debt = epochData.usdDebtDist.getActorValue(actorId);

            _verifyCollateralRatio(
                collateralType,
                debt < 0 ? 0 : uint(debt),
                collateralAmount.mulDecimal(vaultData.collateralPrice)
            );
        }

        emit DelegationUpdated(accountId, fundId, collateralType, collateralAmount, leverage);
    }

    function _calculateDebtShares(
        VaultEpochData storage epochData,
        uint collateralAmount,
        uint leverage
    ) internal view returns (uint) {
        uint totalCollateral = uint(epochData.collateralDist.totalValue());
        if (totalCollateral == 0) {
            return collateralAmount.mulDecimal(leverage);
        }

        return leverage.mulDecimal((uint(epochData.debtDist.totalShares) * collateralAmount) / totalCollateral);
    }

    // ---------------------------------------
    // Mint/Burn USD
    // ---------------------------------------

    function mintUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyWithPermission(accountId, _MINT_PERMISSION) {
        // check if they have sufficient c-ratio to mint that amount
        int debt = _updateAccountDebt(accountId, fundId, collateralType);

        (uint collateralValue, , ) = _accountCollateral(accountId, fundId, collateralType);

        int newDebt = debt + int(amount);

        if (newDebt > 0) {
            _verifyCollateralRatio(collateralType, uint(newDebt), collateralValue);
        }

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        epochData.usdDebtDist.updateActorValue(bytes32(accountId), newDebt);
        _fundModuleStore().funds[fundId].totalLiquidity -= int128(int(amount));
        _getToken(_USD_TOKEN).mint(msg.sender, amount);
    }

    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override {
        int debt = _updateAccountDebt(accountId, fundId, collateralType);

        if (debt < 0) {
            // user shouldn't be able to burn more usd if they already have negative debt
            revert InsufficientDebt(debt);
        }

        if (debt < int(amount)) {
            amount = uint(debt);
        }

        _getToken(_USD_TOKEN).burn(msg.sender, amount);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        epochData.usdDebtDist.updateActorValue(bytes32(accountId), debt - int(amount));
        _fundModuleStore().funds[fundId].totalLiquidity += int128(int(amount));
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function accountCollateralRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (uint) {
        return _accountCollateralRatio(fundId, accountId, collateralType);
    }

    function vaultCollateralRatio(uint fundId, address collateralType) external override returns (uint) {
        return _vaultCollateralRatio(fundId, collateralType);
    }

    function accountVaultCollateral(
        uint accountId,
        uint fundId,
        address collateralType
    )
        external
        view
        override
        returns (
            uint amount,
            uint value,
            uint shares
        )
    {
        return _accountCollateral(accountId, fundId, collateralType);
    }

    function accountVaultDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (int) {
        return _updateAccountDebt(accountId, fundId, collateralType);
    }

    function vaultCollateral(uint fundId, address collateralType) public view override returns (uint amount, uint value) {
        return _vaultCollateral(fundId, collateralType);
    }

    function vaultDebt(uint fundId, address collateralType) public override returns (int) {
        return _vaultDebt(fundId, collateralType);
    }

    function totalVaultShares(uint fundId, address collateralType) external view override returns (uint) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        return uint(epochData.debtDist.totalShares).mulDecimal(epochData.liquidityMultiplier);
    }

    function _verifyCollateralRatio(
        address collateralType,
        uint debt,
        uint collateralValue
    ) internal view {
        uint targetCratio = _getCollateralTargetCRatio(collateralType);

        if (debt != 0 && collateralValue.divDecimal(debt) < targetCratio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), targetCratio);
        }
    }
}
