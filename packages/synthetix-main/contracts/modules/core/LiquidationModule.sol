//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ILiquidationModule.sol";

import "../../storage/Collateral.sol";
import "../../storage/Pool.sol";
import "../../storage/Account.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../utils/ERC20Helper.sol";

contract LiquidationsModule is
    ILiquidationModule,
    AssociatedSystemsMixin
{
    using MathUtil for uint;
    using ERC20Helper for address;

    using CollateralConfiguration for CollateralConfiguration.Data;
    using Collateral for Collateral.Data;
    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;

    error InvalidParameters(string incorrectParameter, string help);

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

        int rawDebt = pool.updateAccountDebt(collateralType, accountId);

        (uint cl, uint collateralValue, ) = pool.currentAccountCollateral(collateralType, accountId);
        collateralLiquidated = cl;

        if (rawDebt <= 0 || !_isLiquidatable(collateralType, uint(rawDebt), collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                debtLiquidated,
                debtLiquidated == 0 ? 0 : collateralValue.divDecimal(debtLiquidated),
                collateralConfig.minimumCRatio
            );
        }

        debtLiquidated = uint(rawDebt);

        VaultEpoch.Data storage vaultEpoch = pool.vaults[collateralType].currentEpoch();

        uint oldShares = vaultEpoch.debtDist.getActorShares(bytes32(uint(uint128(accountId))));

        if (vaultEpoch.debtDist.totalShares == oldShares) {
            // will be left with 0 shares, which can't be socialized
            revert MustBeVaultLiquidated();
        }

        amountRewarded = collateralConfig.liquidationReward;

        if (amountRewarded >= uint(vaultEpoch.collateralDist.totalValue())) {
            // vault is too small to be liquidated socialized
            revert MustBeVaultLiquidated();
        }

        // this will wipe the user from this vault (the debt/collateral/etc will still remain, however)
        pool.vaults[collateralType].clearAccount(accountId);

        // update the pool
        // TODO: move this into dedicated functions
        pool.totalLiquidity -= int128(
            int(amountRewarded.mulDecimal(collateralConfig.getCollateralValue()))
        );

        _applyLiquidationToMultiplier(poolId, collateralType, oldShares);

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
            revert InvalidParameters("liquidateAsAccountId", "account is not created");
        }

        if (maxUsd == 0) {
            revert InvalidParameters("maxUsd", "must be higher than 0");
        }

        Pool.Data storage pool = Pool.load(poolId);
        CollateralConfiguration.Data storage collateralConfig = CollateralConfiguration.load(collateralType);

        Vault.Data storage vault = pool.vaults[collateralType];

        int rawVaultDebt = pool.currentVaultDebt(collateralType);

        uint vaultDebt = rawVaultDebt < 0 ? 0 : uint(rawVaultDebt);

        (, uint collateralValue) = pool.currentVaultCollateral(collateralType);

        if (!_isLiquidatable(collateralType, vaultDebt, collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                vaultDebt,
                vaultDebt > 0 ? collateralValue.divDecimal(vaultDebt) : 0,
                collateralConfig.minimumCRatio
            );
        }

        if (vaultDebt < maxUsd) {
            // full vault liquidation
            _getToken(_USD_TOKEN).burn(msg.sender, vaultDebt);

            amountLiquidated = vaultDebt;
            collateralRewarded = uint(vault.currentEpoch().collateralDist.totalValue());

            pool.resetVault(collateralType);
        } else {
            // partial vault liquidation
            _getToken(_USD_TOKEN).burn(msg.sender, maxUsd);

            VaultEpoch.Data storage epoch = vault.currentEpoch();

            amountLiquidated = maxUsd;
            collateralRewarded = (uint(epoch.collateralDist.totalValue()) * amountLiquidated) / vaultDebt;

            // repay the debt
            // TODO: better data structures
            epoch.debtDist.distribute(-int(amountLiquidated));
            epoch.unclaimedDebt -= int128(int(amountLiquidated));

            // take away the collateral
            epoch.collateralDist.distribute(-int(collateralRewarded));

            // TODO this is probably wrong
            _applyLiquidationToMultiplier(poolId, collateralType, amountLiquidated.divDecimal(vaultDebt));
        }

        // update the pool (debt was repayed but collateral was taken)
        // TODO: better functions
        pool.totalLiquidity += int128(
            int(amountLiquidated) - int(collateralRewarded.mulDecimal(collateralConfig.getCollateralValue()))
        );

        // award the collateral that was just taken to the specified account
        Account.load(liquidateAsAccountId).collaterals[collateralType].depositCollateral(collateralRewarded);

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

        return collateralValue.divDecimal(debt) < CollateralConfiguration.load(collateralType).minimumCRatio;
    }

    function isLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (bool) {
        Pool.Data storage pool = Pool.load(poolId);
        int rawDebt = pool.updateAccountDebt(collateralType, accountId);
        (, uint collateralValue, ) = pool.currentAccountCollateral(collateralType, accountId);
        return rawDebt >= 0 && _isLiquidatable(collateralType, uint(rawDebt), collateralValue);
    }

    /**
     * TODO: this function belongs in vault or something
     */
    function _applyLiquidationToMultiplier(
        uint128 poolId,
        address collateralType,
        uint liquidatedShares
    ) internal {
        Pool.Data storage pool = Pool.load(poolId);
        VaultEpoch.Data storage epochData = pool.vaults[collateralType].currentEpoch();

        uint oldTotalShares = liquidatedShares + epochData.debtDist.totalShares;

        uint newLiquidityMultiplier = (uint(epochData.liquidityMultiplier) * oldTotalShares) /
            epochData.debtDist.totalShares;

        // update totalLiquidity (to stay exact)
        pool.totalLiquidity = int128(
            pool.totalLiquidity +
                int(uint(epochData.debtDist.totalShares).mulDecimal(newLiquidityMultiplier)) -
                int(oldTotalShares.mulDecimal(epochData.liquidityMultiplier))
        );

        // update debt adjustments
        epochData.liquidityMultiplier = uint128(newLiquidityMultiplier);
    }
}
