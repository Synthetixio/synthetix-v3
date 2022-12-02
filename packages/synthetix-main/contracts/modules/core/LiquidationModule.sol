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

    error IneligibleForLiquidation(uint collateralValue, uint debt, uint currentCRatio, uint cratio);

    error MustBeVaultLiquidated();

    bytes32 private constant _USD_TOKEN = "USDToken";

    function liquidate(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    )
        external
        override
        returns (
            uint amountRewarded,
            uint debtLiquidated,
            uint collateralLiquidated
        )
    {
        Pool.Data storage pool = Pool.load(poolId);
        CollateralConfiguration.Data storage collateralConfig = CollateralConfiguration.load(collateralType);
        VaultEpoch.Data storage epoch = pool.vaults[collateralType].currentEpoch();

        int rawDebt = pool.updateAccountDebt(collateralType, accountId);

        (uint collateralAmount, uint collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        collateralLiquidated = collateralAmount;

        debtLiquidated = rawDebt.toUint();

        if (rawDebt <= 0 || !_isLiquidatable(collateralType, rawDebt.toUint(), collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                debtLiquidated,
                debtLiquidated == 0 ? 0 : collateralValue.divDecimal(debtLiquidated),
                collateralConfig.liquidationRatioD18
            );
        }

        uint oldShares = epoch.accountsDebtDistribution.getActorShares(bytes32(uint(accountId)));

        if (epoch.accountsDebtDistribution.totalSharesD18 == oldShares) {
            // will be left with 0 shares, which can't be socialized
            revert MustBeVaultLiquidated();
        }

        amountRewarded = collateralConfig.liquidationRewardD18;

        if (amountRewarded >= epoch.collateralAmounts.totalAmount()) {
            // vault is too small to be liquidated socialized
            revert MustBeVaultLiquidated();
        }

        // this will clear the user's account the same way as if they had unstaked normally
        epoch.updateAccountPosition(accountId, 0, 0);

        // we don't give the collateral back to the user though--it gets
        // fed back into the vault proportionally to the amount of collateral you have
        // the vault might end up with less overall collateral if liquidation reward
        // is greater than the actual collateral in this user's account
        epoch.collateralAmounts.scale(collateralLiquidated.toInt() - amountRewarded.toInt());

        // debt isn't cleared when someone unstakes by default, so we do it separately here
        epoch.assignDebtToAccount(accountId, -debtLiquidated.toInt());

        // now we feed the debt back in also
        epoch.distributeDebtToAccounts(debtLiquidated.toInt());

        // send reward
        collateralType.safeTransfer(msg.sender, amountRewarded);

        // TODO: send any remaining collateral to the liquidated account? need to have a liquidation penalty setting or something

        emit Liquidation(accountId, poolId, collateralType, debtLiquidated, collateralLiquidated, amountRewarded);
    }

    function liquidateVault(
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId,
        uint maxUsd
    ) external override returns (uint amountLiquidated, uint collateralRewarded) {
        if (Account.load(liquidateAsAccountId).rbac.owner == address(0)) {
            revert ParameterError.InvalidParameter("liquidateAsAccountId", "account is not created");
        }

        if (maxUsd == 0) {
            revert ParameterError.InvalidParameter("maxUsd", "must be higher than 0");
        }

        Pool.Data storage pool = Pool.load(poolId);
        CollateralConfiguration.Data storage collateralConfig = CollateralConfiguration.load(collateralType);

        Vault.Data storage vault = pool.vaults[collateralType];

        int rawVaultDebt = pool.currentVaultDebt(collateralType);

        uint vaultDebt = rawVaultDebt < 0 ? 0 : rawVaultDebt.toUint();

        (, uint collateralValue) = pool.currentVaultCollateral(collateralType);

        if (!_isLiquidatable(collateralType, vaultDebt, collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                vaultDebt,
                vaultDebt > 0 ? collateralValue.divDecimal(vaultDebt) : 0,
                collateralConfig.liquidationRatioD18
            );
        }

        if (vaultDebt <= maxUsd) {
            // full vault liquidation
            AssociatedSystem.load(_USD_TOKEN).asToken().burn(msg.sender, vaultDebt);

            amountLiquidated = vaultDebt;
            collateralRewarded = vault.currentEpoch().collateralAmounts.totalAmount();

            pool.resetVault(collateralType);
        } else {
            // partial vault liquidation
            AssociatedSystem.load(_USD_TOKEN).asToken().burn(msg.sender, maxUsd);

            VaultEpoch.Data storage epoch = vault.currentEpoch();

            amountLiquidated = maxUsd;
            collateralRewarded = (epoch.collateralAmounts.totalAmount() * amountLiquidated) / vaultDebt;

            // repay the debt
            // TODO: better data structures
            epoch.accountsDebtDistribution.distributeValue(-amountLiquidated.toInt());
            epoch.unconsolidatedDebtD18 -= amountLiquidated.toInt().to128();

            // take away the collateral
            epoch.collateralAmounts.scale(-collateralRewarded.toInt());
        }

        // award the collateral that was just taken to the specified account
        Account.load(liquidateAsAccountId).collaterals[collateralType].deposit(collateralRewarded);

        emit VaultLiquidation(poolId, collateralType, amountLiquidated, collateralRewarded, collateralRewarded);
    }

    function _isLiquidatable(
        address collateralType,
        uint debt,
        uint collateralValue
    ) internal view returns (bool) {
        if (debt == 0) {
            return false;
        }

        return collateralValue.divDecimal(debt) < CollateralConfiguration.load(collateralType).liquidationRatioD18;
    }

    function isLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (bool) {
        Pool.Data storage pool = Pool.load(poolId);
        int rawDebt = pool.updateAccountDebt(collateralType, accountId);
        (, uint collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        return rawDebt >= 0 && _isLiquidatable(collateralType, rawDebt.toUint(), collateralValue);
    }
}
