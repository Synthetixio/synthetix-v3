//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../../storage/Account.sol";
import "../../storage/Pool.sol";

import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

/**
 * @title See {IVaultModule}
 */
contract VaultModule is IVaultModule {
    using SetUtil for SetUtil.UintSet;
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;
    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Collateral for Collateral.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using AccountRBAC for AccountRBAC.Data;
    using Distribution for Distribution.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;

    error InsufficientAccountCollateral(uint requestedAmount);
    error PoolNotFound(uint128 poolId);
    error InvalidLeverage(uint leverage);
    error InvalidParameters(string incorrectParameter, string help);
    error InvalidCollateral(address collateralType);
    error CapacityLocked(uint marketId);

    /**
     * @dev See {IVaultModule-delegateCollateral}.
     *
     * TODO: This function is too long, does too many things, needs to be split into sub-functions.
     */
    function delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    ) external override {
        Pool.requireExists(poolId);
        CollateralConfiguration.collateralEnabled(collateralType);
        Account.onlyWithPermission(accountId, AccountRBAC._DELEGATE_PERMISSION);

        // Fix leverage to 1 until it's enabled
        // TODO: we will probably at least want to test <1 leverage
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];

        vault.updateRewards(accountId);

        // get the current collateral situation
        uint oldCollateralAmount = vault.currentAccountCollateral(accountId);
        uint collateralPrice;

        // if increasing collateral additionally check they have enough collateral
        if (
            collateralAmount > oldCollateralAmount &&
            Account.load(accountId).collaterals[collateralType].availableAmount < collateralAmount - oldCollateralAmount
        ) {
            revert InsufficientAccountCollateral(collateralAmount);
        }

        bytes32 actorId = bytes32(uint(accountId));

        // stack too deep after this
        {
            Pool.Data storage pool = Pool.load(poolId);

            // the current user may have accumulated some debt which needs to be rolled in before changing shares
            pool.updateAccountDebt(collateralType, accountId);

            Collateral.Data storage collateral = Account.load(accountId).collaterals[collateralType];

            // adjust the user's current account collateral to reflect the change in delegation
            if (collateralAmount > oldCollateralAmount) {
                collateral.deductCollateral(collateralAmount - oldCollateralAmount);
            } else {
                collateral.deposit(oldCollateralAmount - collateralAmount);
            }

            if (collateralAmount > 0 && !collateral.pools.contains(uint(poolId))) {
                collateral.pools.add(poolId);
            } else if (collateral.pools.contains((uint(poolId)))) {
                collateral.pools.remove(poolId);
            }

            vault.currentEpoch().updateAccountPosition(accountId, collateralAmount, leverage);

            // no update for usd because no usd issued
            collateralPrice = pool.recalculateVaultCollateral(collateralType);
        }

        _setDelegatePoolId(accountId, poolId, collateralType);

        // this is the most efficient time to check the resulting collateralization ratio, since
        // user's debt and collateral price have been fully updated
        if (collateralAmount < oldCollateralAmount) {
            int debt = vault.currentEpoch().consolidatedDebtDist.getActorValue(actorId);
            //(, uint collateralValue) = pool.currentAccountCollateral(collateralType, accountId);

            CollateralConfiguration.load(collateralType).verifyCollateralRatio(
                debt < 0 ? 0 : uint(debt),
                collateralAmount.mulDecimal(collateralPrice)
            );
        }

        if (
            collateralAmount < oldCollateralAmount /* || leverage < oldLeverage */
        ) {
            // if pool contains any capacity-locked markets, account cannot reduce their position
            _verifyNotCapacityLocked(poolId);
        }

        emit DelegationUpdated(accountId, poolId, collateralType, collateralAmount, leverage, msg.sender);
    }

    // ---------------------------------------
    // Collateralization Ratio and Debt Queries
    // ---------------------------------------

    /**
     * @dev See {IVaultModule-getPositionCollateralizationRatio}.
     */
    function getPositionCollateralizationRatio(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (uint) {
        return Pool.load(poolId).currentAccountCollateralizationRatio(collateralType, accountId);
    }

    /**
     * @dev See {IVaultModule-getVaultCollateralRatio}.
     */
    function getVaultCollateralRatio(uint128 poolId, address collateralType) external override returns (uint) {
        return Pool.load(poolId).currentVaultCollateralRatio(collateralType);
    }

    /**
     * @dev See {IVaultModule-getPositionCollateral}.
     */
    function getPositionCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view override returns (uint amount, uint value) {
        (amount, value) = Pool.load(poolId).currentAccountCollateral(collateralType, accountId);
    }

    /**
     * @dev See {IVaultModule-getPosition}.
     */
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
        (collateralAmount, collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        collateralizationRatio = pool.currentAccountCollateralizationRatio(collateralType, accountId);
    }

    /**
     * @dev See {IVaultModule-getPositionDebt}.
     */
    function getPositionDebt(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (int) {
        return Pool.load(poolId).updateAccountDebt(collateralType, accountId);
    }

    /**
     * @dev See {IVaultModule-getVaultCollateral}.
     */
    function getVaultCollateral(uint128 poolId, address collateralType)
        public
        view
        override
        returns (uint amount, uint value)
    {
        return Pool.load(poolId).currentVaultCollateral(collateralType);
    }

    /**
     * @dev See {IVaultModule-getVaultDebt}.
     */
    function getVaultDebt(uint128 poolId, address collateralType) public override returns (int) {
        return Pool.load(poolId).currentVaultDebt(collateralType);
    }

    function _verifyNotCapacityLocked(uint128 poolId) internal view {
        Pool.Data storage pool = Pool.load(poolId);

        Market.Data storage market = pool.findMarketCapacityLocked();

        if (market.id > 0) {
            revert CapacityLocked(market.id);
        }
    }

    /**
     * @dev Registers the pool to which users delegates collateral to.
     */
    function _setDelegatePoolId(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) internal {
        Collateral.Data storage stakedCollateral = Account.load(accountId).collaterals[collateralType];

        if (!stakedCollateral.pools.contains(poolId)) {
            stakedCollateral.pools.add(poolId);
        }
    }
}
