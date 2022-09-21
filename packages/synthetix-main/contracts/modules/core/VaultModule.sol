//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../storage/Pool.sol";

import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

contract VaultModule is IVaultModule, OwnableMixin {
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    using Vault for Vault.Data;

    using SharesLibrary for SharesLibrary.Distribution;

    bytes32 private constant _USD_TOKEN = "USDToken";

    error InvalidLeverage(uint leverage);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDebt(int currentDebt);
    error InvalidParameters(string incorrectParameter, string help);

    function delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    )
        external
        override
        Account.onlyWithPermission(accountId, AccountRBAC._DELEGATE_PERMISSION)
        collateralEnabled(collateralType)
        poolExists(poolId)
    {
        // Fix leverage to 1 until it's enabled
        // TODO: we will probably at least want to test <1 leverage
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        Collateral.Data storage collateral = Account.load(accountId).collaterals[collateralType];

        Pool.Data storage pool = Pool.load(poolId);
        Vault.Data storage vault = pool.vaults[collateralType];

        pool.updateAvailableRewards(epochData, vaultData.rewards, accountId);

        // get the current collateral situation
        (uint oldCollateralAmount, , ) = pool.currentAccountCollateral(collateralType, accountId);

        // if increasing collateral additionally check they have enough collateral
        if (
            collateralAmount > oldCollateralAmount &&
            collateral.getAccountUnassignedCollateral() < collateralAmount - oldCollateralAmount
        ) {
            revert InsufficientAccountCollateral(accountId, collateralType, collateralAmount);
        }

        bytes32 actorId = bytes32(accountId);

        // stack too deep after this
        {
            // if decreasing collateral additionally check they have sufficient c-ratio

            pool.recalculateVaultCollateral(collateralType);

            uint vaultShares = _calculateVaultShares(epochData, collateralAmount, leverage);

            // prevent users from specifying an infitesimly small amount such that they don't get any shares
            if (vaultShares == 0 && collateralAmount > 0) {
                revert InvalidParameters("amount", "must be large enough for 1 share");
            }

            vault.currentEpoch().collateralDist.updateActorValue(actorId, int(collateralAmount));
            vault.currentEpoch().debtDist.updateActorShares(actorId, vaultShares);
            // no update for usd because no usd issued

            // this will ensure the new distribution information is passed up the chain to the markets
            pool.updateAccountDebt(accountId, poolId, collateralType);
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
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint amount
    ) external override Account.onlyWithPermission(accountId, AccountRBAC._MINT_PERMISSION) {
        // check if they have sufficient c-ratio to mint that amount
        int debt = _updatePositionDebt(accountId, poolId, collateralType);

        (, uint collateralValue, ) = _positionCollateral(accountId, poolId, collateralType);

        int newDebt = debt + int(amount);

        if (newDebt > 0) {
            _verifyCollateralRatio(collateralType, uint(newDebt), collateralValue);
        }

        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        epoch.usdDebtDist.updateActorValue(bytes32(accountId), newDebt);
        Pool.load(poolId).totalLiquidity -= int128(int(amount));
        _getToken(_USD_TOKEN).mint(msg.sender, amount);

        emit UsdMinted(accountId, poolId, collateralType, amount, msg.sender);
    }

    function burnUsd(
        uint128 accountId,
        uint128 poolId,
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


        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        epoch.usdDebtDist.updateActorValue(bytes32(accountId), debt - int(amount));
        Pool.load(poolId).totalLiquidity += int128(int(amount));

        emit UsdBurned(accountId, poolId, collateralType, amount, msg.sender);
    }

    // ---------------------------------------
    // Collateralization Ratio and Debt Queries
    // ---------------------------------------

    function getPositionCollateralizationRatio(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (uint) {
        return Pool.load(poolId).currentAccountCollateralizationRatio(collateralType, accountId);
    }

    function getVaultCollateralRatio(uint128 poolId, address collateralType) external override returns (uint) {
        return Pool.load(poolId).currentVaultCollateralRatio(collateralType);
    }

    function getPositionCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view override returns (uint amount, uint value) {
        (amount, value, ) = Pool.load(poolId).currentAccountCollateral(collateralType, accountId);
    }

    function getPosition(
        uint128 accountId,
        uint128 poolId,
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
        Pool.Data storage pool = Pool.load(poolId);

        debt = pool.updateAccountDebt(collateralType, accountId);
        (collateralAmount, collateralValue, ) = pool.currentAccountCollateral(collateralType, accountId);
        collateralizationRatio = pool.currentAccountCollateralizationRatio(collateralType, accountId);
    }

    function getPositionDebt(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (int) {
        return _updatePositionDebt(accountId, poolId, collateralType);
    }

    function getVaultCollateral(uint128 poolId, address collateralType) public view override returns (uint amount, uint value) {
        return Pool.load(poolId).currentVaultCollateral(collateralType);
    }

    function getVaultDebt(uint128 poolId, address collateralType) public override returns (int) {
        return Pool.load(poolId).updateVaultDebt(collateralType);
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
