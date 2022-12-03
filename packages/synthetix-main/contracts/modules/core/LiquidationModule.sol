//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ILiquidationModule.sol";

import "../../storage/Collateral.sol";
import "../../storage/Pool.sol";
import "../../storage/Account.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @inheritdoc ILiquidationModule
 */
contract LiquidationModule is ILiquidationModule {
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    using DecimalMath for uint;
    using ERC20Helper for address;

    using AssociatedSystem for AssociatedSystem.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Collateral for Collateral.Data;
    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using ScalableMapping for ScalableMapping.Data;

    error IneligibleForLiquidation(uint collateralValue, int debt, uint currentCRatio, uint cratio);

    error MustBeVaultLiquidated();

    bytes32 private constant _USD_TOKEN = "USDToken";

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidate(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId
    )
        external
        override
        returns (
            uint amountRewarded,
            uint debtLiquidated,
            uint collateralLiquidated
        )
    {
        // Ensure the account receiving rewards exists
        Account.exists(liquidateAsAccountId);

        Pool.Data storage pool = Pool.load(poolId);
        CollateralConfiguration.Data storage collateralConfig = CollateralConfiguration.load(collateralType);
        VaultEpoch.Data storage epoch = pool.vaults[collateralType].currentEpoch();

        int rawDebt = pool.updateAccountDebt(collateralType, accountId);
        (uint collateralAmount, uint collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        collateralLiquidated = collateralAmount;

        // Verify whether the position is eligible for liquidation
        if (rawDebt <= 0 || !_isLiquidatable(collateralType, rawDebt, collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                rawDebt,
                rawDebt <= 0 ? 0 : collateralValue.divDecimal(rawDebt.toUint()),
                collateralConfig.liquidationRatioD18
            );
        }

        debtLiquidated = rawDebt.toUint();

        uint liquidatedAccountShares = epoch.accountsDebtDistribution.getActorShares(bytes32(uint(accountId)));
        if (epoch.accountsDebtDistribution.totalSharesD18 == liquidatedAccountShares) {
            // will be left with 0 shares, which can't be socialized
            revert MustBeVaultLiquidated();
        }

        // Although amountRewarded is the minimum to delegate to a vault, this value may increase in the future
        amountRewarded = collateralConfig.liquidationRewardD18;
        if (amountRewarded >= epoch.collateralAmounts.totalAmount()) {
            // vault is too small to be liquidated socialized
            revert MustBeVaultLiquidated();
        }

        // This will clear the user's account the same way as if they had unstaked normally
        epoch.updateAccountPosition(accountId, 0, 0);

        // Distribute the liquidated collateral among other positions in the vault, minus the reward amount
        epoch.collateralAmounts.scale(collateralLiquidated.toInt() - amountRewarded.toInt());

        // Remove the debt assigned to the liquidated account
        epoch.assignDebtToAccount(accountId, -debtLiquidated.toInt());

        // Distribute this debt among other accounts in the vault
        epoch.distributeDebtToAccounts(debtLiquidated.toInt());

        // The collateral is reduced by `amountRewarded`, so we need to reduce the stablecoins capacity available to the markets
        pool.recalculateVaultCollateral(collateralType);

        // Send amountRewarded to the specified account
        Account.load(liquidateAsAccountId).collaterals[collateralType].deposit(amountRewarded);

        emit Liquidation(accountId, poolId, collateralType, debtLiquidated, collateralLiquidated, amountRewarded);
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidateVault(
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId,
        uint maxUsd
    ) external override returns (uint amountLiquidated, uint collateralRewarded) {
        // Ensure the account receiving collateral exists
        Account.exists(liquidateAsAccountId);

        // The liquidator must provide at least some stablecoins to repay debt
        if (maxUsd == 0) {
            revert ParameterError.InvalidParameter("maxUsd", "must be higher than 0");
        }

        Pool.Data storage pool = Pool.load(poolId);
        CollateralConfiguration.Data storage collateralConfig = CollateralConfiguration.load(collateralType);
        Vault.Data storage vault = pool.vaults[collateralType];

        // Retrieve the collateral and the debt of the vault
        int rawVaultDebt = pool.currentVaultDebt(collateralType);
        (, uint collateralValue) = pool.currentVaultCollateral(collateralType);

        // Verify whether the vault is eligible for liquidation
        if (!_isLiquidatable(collateralType, rawVaultDebt, collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                rawVaultDebt,
                rawVaultDebt > 0 ? collateralValue.divDecimal(rawVaultDebt.toUint()) : 0,
                collateralConfig.liquidationRatioD18
            );
        }

        uint vaultDebt = rawVaultDebt < 0 ? 0 : rawVaultDebt.toUint();

        if (vaultDebt <= maxUsd) {
            // Conduct a full vault liquidation
            amountLiquidated = vaultDebt;

            // Burn all of the stablecoins necessary to clear the debt of this vault
            AssociatedSystem.load(_USD_TOKEN).asToken().burn(msg.sender, vaultDebt);

            // Provide all of the collateral to the liquidator
            collateralRewarded = vault.currentEpoch().collateralAmounts.totalAmount();

            // Increment the epoch counter
            pool.resetVault(collateralType);
        } else {
            // Conduct a partial vault liquidation
            amountLiquidated = maxUsd;

            // Burn all of the stablecoins provided by the liquidator
            AssociatedSystem.load(_USD_TOKEN).asToken().burn(msg.sender, maxUsd);

            VaultEpoch.Data storage epoch = vault.currentEpoch();

            // Provide the proportional amount of collateral to the liquidator
            collateralRewarded = (epoch.collateralAmounts.totalAmount() * amountLiquidated) / vaultDebt;

            // Reduce the debt of the remaining positions in the vault
            epoch.distributeDebtToAccounts(-amountLiquidated.toInt());

            // Reduce the collateral of the remaining positions in the vault
            epoch.collateralAmounts.scale(-collateralRewarded.toInt());
        }

        // Send collateralRewarded to the specified account
        Account.load(liquidateAsAccountId).collaterals[collateralType].deposit(collateralRewarded);

        emit VaultLiquidation(
            poolId,
            collateralType,
            amountLiquidated,
            collateralRewarded,
            liquidateAsAccountId,
            msg.sender
        );
    }

    /**
     * @dev Returns whether a combination of debt and credit is liquidatable for a specified collateral type
     */
    function _isLiquidatable(
        address collateralType,
        int debt,
        uint collateralValue
    ) internal view returns (bool) {
        if (debt <= 0) {
            return false;
        }
        return collateralValue.divDecimal(debt.toUint()) < CollateralConfiguration.load(collateralType).liquidationRatioD18;
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function isPositionLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (bool) {
        Pool.Data storage pool = Pool.load(poolId);
        int rawDebt = pool.updateAccountDebt(collateralType, accountId);
        (, uint collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        return rawDebt >= 0 && _isLiquidatable(collateralType, rawDebt, collateralValue);
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function isVaultLiquidatable(uint128 poolId, address collateralType) external override returns (bool) {
        Pool.Data storage pool = Pool.load(poolId);
        int rawVaultDebt = pool.currentVaultDebt(collateralType);
        (, uint collateralValue) = pool.currentVaultCollateral(collateralType);
        return rawVaultDebt >= 0 && _isLiquidatable(collateralType, rawVaultDebt, collateralValue);
    }
}
