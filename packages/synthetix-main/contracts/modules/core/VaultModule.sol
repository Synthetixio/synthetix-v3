//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/PoolMixin.sol";

import "../../utils/SharesLibrary.sol";

import "../../storage/PoolVaultStorage.sol";
import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

contract VaultModule is IVaultModule, PoolVaultStorage, AccountRBACMixin, OwnableMixin, AssociatedSystemsMixin, PoolMixin {
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    using SharesLibrary for SharesLibrary.Distribution;

    bytes32 private constant _USD_TOKEN = "USDToken";

    error InvalidLeverage(uint leverage);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDebt(int currentDebt);
    error InvalidParameters(string incorrectParameter, string help);

    function delegateCollateral(
        uint accountId,
        uint poolId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    )
        external
        override
        onlyWithPermission(accountId, _ASSIGN_PERMISSION)
        collateralEnabled(collateralType)
        poolExists(poolId)
    {
        // Fix leverage to 1 until it's enabled
        // TODO: we will probably at least want to test <1 leverage
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        _updateAvailableRewards(epochData, vaultData.rewards, accountId);

        // get the current collateral situation
        (uint oldCollateralAmount, , ) = _positionCollateral(accountId, poolId, collateralType);

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

            _distributeVaultDebt(poolId, collateralType);

            uint vaultShares = _calculateVaultShares(epochData, collateralAmount, leverage);

            // prevent users from specifying an infitesimly small amount such that they don't get any shares
            if (vaultShares == 0 && collateralAmount > 0) {
                revert InvalidParameters("amount", "must be large enough for 1 share");
            }

            epochData.collateralDist.updateActorValue(actorId, int(collateralAmount));
            epochData.debtDist.updateActorShares(actorId, vaultShares);
            // no update for usd because no usd issued

            // this will ensure the new distribution information is passed up the chain to the markets
            _updatePositionDebt(accountId, poolId, collateralType);
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

        emit DelegationUpdated(accountId, poolId, collateralType, collateralAmount, leverage, msg.sender);
    }

    function _calculateVaultShares(
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

    function mintUsd(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount
    ) external override onlyWithPermission(accountId, _MINT_PERMISSION) {
        // check if they have sufficient c-ratio to mint that amount
        int debt = _updatePositionDebt(accountId, poolId, collateralType);

        (, uint collateralValue, ) = _positionCollateral(accountId, poolId, collateralType);

        int newDebt = debt + int(amount);

        if (newDebt > 0) {
            _verifyCollateralRatio(collateralType, uint(newDebt), collateralValue);
        }

        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        epochData.usdDebtDist.updateActorValue(bytes32(accountId), newDebt);
        _poolModuleStore().pools[poolId].totalLiquidity -= int128(int(amount));
        _getToken(_USD_TOKEN).mint(msg.sender, amount);

        emit UsdMinted(accountId, poolId, collateralType, amount, msg.sender);
    }

    function burnUsd(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount
    ) external override {
        int debt = _updatePositionDebt(accountId, poolId, collateralType);

        if (debt < 0) {
            // user shouldn't be able to burn more usd if they already have negative debt
            revert InsufficientDebt(debt);
        }

        if (debt < int(amount)) {
            amount = uint(debt);
        }

        _getToken(_USD_TOKEN).burn(msg.sender, amount);

        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        epochData.usdDebtDist.updateActorValue(bytes32(accountId), debt - int(amount));
        _poolModuleStore().pools[poolId].totalLiquidity += int128(int(amount));

        emit UsdBurned(accountId, poolId, collateralType, amount, msg.sender);
    }

    // ---------------------------------------
    // Collateralization Ratio and Debt Queries
    // ---------------------------------------

    function getPositionCollateralizationRatio(
        uint accountId,
        uint poolId,
        address collateralType
    ) external override returns (uint) {
        return _positionCollateralizationRatio(poolId, accountId, collateralType);
    }

    function getVaultCollateralRatio(uint poolId, address collateralType) external override returns (uint) {
        return _vaultCollateralRatio(poolId, collateralType);
    }

    function getPositionCollateral(
        uint accountId,
        uint poolId,
        address collateralType
    ) external view override returns (uint amount, uint value) {
        (amount, value, ) = _positionCollateral(accountId, poolId, collateralType);
    }

    function getPosition(
        uint accountId,
        uint poolId,
        address collateralType
    )
        external
        override
        returns (
            uint collateralAmount,
            uint collateralValue,
            int debt,
            uint collateralizationRatio
        )
    {
        debt = _updatePositionDebt(accountId, poolId, collateralType);
        (collateralAmount, collateralValue, ) = _positionCollateral(accountId, poolId, collateralType);
        collateralizationRatio = _positionCollateralizationRatio(poolId, accountId, collateralType);
    }

    function getPositionDebt(
        uint accountId,
        uint poolId,
        address collateralType
    ) external override returns (int) {
        return _updatePositionDebt(accountId, poolId, collateralType);
    }

    function getVaultCollateral(uint poolId, address collateralType) public view override returns (uint amount, uint value) {
        return _vaultCollateral(poolId, collateralType);
    }

    function getVaultDebt(uint poolId, address collateralType) public override returns (int) {
        return _vaultDebt(poolId, collateralType);
    }

    function _verifyCollateralRatio(
        address collateralType,
        uint debt,
        uint collateralValue
    ) internal view {
        uint targetCratio = _collateralTargetCRatio(collateralType);

        if (debt != 0 && collateralValue.divDecimal(debt) < targetCratio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), targetCratio);
        }
    }
}
