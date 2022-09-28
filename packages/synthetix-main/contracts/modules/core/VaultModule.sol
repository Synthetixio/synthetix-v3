//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../storage/Account.sol";
import "../../storage/Pool.sol";

import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

import "hardhat/console.sol";

contract VaultModule is IVaultModule, AssociatedSystemsMixin, OwnableMixin {
    using SetUtil for SetUtil.UintSet;
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Collateral for Collateral.Data;
    using AccountRBAC for AccountRBAC.Data;

    using Distribution for Distribution.Data;

    bytes32 private constant _USD_TOKEN = "USDToken";

    error InsufficientAccountCollateral(uint requestedAmount);
    error PermissionDenied(uint128 accountId, bytes32 permission, address target);
    error PoolNotFound(uint128 poolId);
    error InvalidLeverage(uint leverage);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDebt(int currentDebt);
    error InvalidParameters(string incorrectParameter, string help);
    error InvalidCollateral(address collateralType);

    function delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    )
        external
        override
        onlyWithPermission(accountId, AccountRBAC._DELEGATE_PERMISSION)
        collateralEnabled(collateralType)
        poolExists(poolId)
    {
        // Fix leverage to 1 until it's enabled
        // TODO: we will probably at least want to test <1 leverage
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];

        vault.updateAvailableRewards(accountId);

        // get the current collateral situation
        (uint oldCollateralAmount, ) = vault.currentAccountCollateral(accountId);
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
                collateral.depositCollateral(oldCollateralAmount - collateralAmount);
            }

            if (collateralAmount > 0 && !collateral.pools.contains(uint(poolId))) {
                collateral.pools.add(poolId);
            } else if (collateral.pools.contains((uint(poolId)))) {
                collateral.pools.remove(poolId);
            }

            vault.currentEpoch().setAccount(accountId, collateralAmount, leverage);
            // no update for usd because no usd issued
            collateralPrice = pool.recalculateVaultCollateral(collateralType);
        }

        // this is the most efficient time to check the resulting collateralization ratio, since
        // user's debt and collateral price have been fully updated
        if (collateralAmount < oldCollateralAmount) {
            int debt = vault.currentEpoch().usdDebtDist.getActorValue(actorId);
            //(, uint collateralValue,) = pool.currentAccountCollateral(collateralType, accountId);

            _verifyCollateralRatio(collateralType, debt < 0 ? 0 : uint(debt), collateralAmount.mulDecimal(collateralPrice));
        }

        emit DelegationUpdated(accountId, poolId, collateralType, collateralAmount, leverage, msg.sender);
    }

    // ---------------------------------------
    // Mint/Burn USD
    // ---------------------------------------

    function mintUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint amount
    ) external override onlyWithPermission(accountId, AccountRBAC._MINT_PERMISSION) {
        // check if they have sufficient c-ratio to mint that amount
        Pool.Data storage pool = Pool.load(poolId);

        int debt = pool.updateAccountDebt(collateralType, accountId);

        (, uint collateralValue, ) = pool.currentAccountCollateral(collateralType, accountId);

        int newDebt = debt + int(amount);

        if (newDebt > 0) {
            _verifyCollateralRatio(collateralType, uint(newDebt), collateralValue);
        }

        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        epoch.usdDebtDist.updateActorValue(bytes32(uint(accountId)), newDebt);
        pool.recalculateVaultCollateral(collateralType);
        _getToken(_USD_TOKEN).mint(msg.sender, amount);

        emit UsdMinted(accountId, poolId, collateralType, amount, msg.sender);
    }

    function burnUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint amount
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);
        int debt = pool.updateAccountDebt(collateralType, accountId);

        if (debt < 0) {
            // user shouldn't be able to burn more usd if they already have negative debt
            revert InsufficientDebt(debt);
        }

        if (debt < int(amount)) {
            amount = uint(debt);
        }

        _getToken(_USD_TOKEN).burn(msg.sender, amount);

        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        epoch.usdDebtDist.updateActorValue(bytes32(uint(accountId)), debt - int(amount));
        pool.recalculateVaultCollateral(collateralType);

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
        return Pool.load(poolId).updateAccountDebt(collateralType, accountId);
    }

    function getVaultCollateral(uint128 poolId, address collateralType)
        public
        view
        override
        returns (uint amount, uint value)
    {
        return Pool.load(poolId).currentVaultCollateral(collateralType);
    }

    function getVaultDebt(uint128 poolId, address collateralType) public override returns (int) {
        return Pool.load(poolId).currentVaultDebt(collateralType);
    }

    function _verifyCollateralRatio(
        address collateralType,
        uint debt,
        uint collateralValue
    ) internal view {
        CollateralConfiguration.Data storage config = CollateralConfiguration.load(collateralType);

        if (debt != 0 && collateralValue.divDecimal(debt) < config.targetCRatio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), config.targetCRatio);
        }
    }

    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }

    modifier collateralEnabled(address collateralType) {
        if (!CollateralConfiguration.load(collateralType).stakingEnabled) {
            revert InvalidCollateral(collateralType);
        }

        _;
    }

    modifier poolExists(uint128 poolId) {
        if (!Pool.exists(poolId)) {
            revert PoolNotFound(poolId);
        }
        _;
    }
}
