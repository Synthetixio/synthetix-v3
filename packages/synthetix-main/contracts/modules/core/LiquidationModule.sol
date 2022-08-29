//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ILiquidationModule.sol";
import "../../storage/LiquidationModuleStorage.sol";

import "../../mixins/CollateralMixin.sol";
import "../../mixins/PoolMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../utils/ERC20Helper.sol";
import "../../utils/SharesLibrary.sol";

contract LiquidationsModule is
    ILiquidationModule,
    LiquidationModuleStorage,
    AssociatedSystemsMixin,
    CollateralMixin,
    PoolMixin,
    AccountRBACMixin
{
    using MathUtil for uint;
    using ERC20Helper for address;
    using SharesLibrary for SharesLibrary.Distribution;

    event Liquidation(
        uint indexed accountId,
        uint indexed poolId,
        address indexed collateralType,
        uint debtLiquidated,
        uint collateralLiquidated,
        uint amountRewarded
    );

    event VaultLiquidation(
        uint indexed poolId,
        address indexed collateralType,
        uint debtLiquidated,
        uint collateralLiquidated,
        uint amountRewarded
    );

    error IneligibleForLiquidation(uint collateralValue, uint debt, uint currentCRatio, uint cratio);

    error MustBeVaultLiquidated();

    bytes32 private constant _USD_TOKEN = "USDToken";

    function liquidate(
        uint accountId,
        uint poolId,
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
        int rawDebt = _updateAccountDebt(accountId, poolId, collateralType);

        (uint cl, uint collateralValue, ) = _accountCollateral(accountId, poolId, collateralType);
        collateralLiquidated = cl;

        if (rawDebt <= 0 || !_isLiquidatable(collateralType, uint(rawDebt), collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                debtLiquidated,
                debtLiquidated == 0 ? 0 : collateralValue.divDecimal(debtLiquidated),
                _getCollateralMinimumCRatio(collateralType)
            );
        }

        debtLiquidated = uint(rawDebt);

        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        uint oldShares = epochData.debtDist.getActorShares(bytes32(accountId));

        if (epochData.debtDist.totalShares == oldShares) {
            // will be left with 0 shares, which can't be socialized
            revert MustBeVaultLiquidated();
        }

        amountRewarded = _getCollateralLiquidationReward(collateralType);

        if (amountRewarded >= uint(epochData.collateralDist.totalValue())) {
            // vault is too small to be liquidated socialized
            revert MustBeVaultLiquidated();
        }

        // need to do this before modifying any actor information
        _updateAvailableRewards(epochData, vaultData.rewards, accountId);

        // take away all the user's shares. by not giving the user back their portion of collateral, it will be
        // auto split proportionally between all debt holders
        epochData.collateralDist.updateActorShares(bytes32(accountId), 0);
        epochData.debtDist.updateActorShares(bytes32(accountId), 0);
        epochData.usdDebtDist.updateActorShares(bytes32(accountId), 0);

        // use distribute to socialize the debt/collateral we just erased
        epochData.collateralDist.distribute(int(collateralLiquidated - amountRewarded));
        epochData.debtDist.distribute(int(debtLiquidated));
        epochData.unclaimedDebt += int128(int(debtLiquidated));

        // update the pool
        _poolModuleStore().pools[poolId].totalLiquidity -= int128(
            int(amountRewarded.mulDecimal(_getCollateralValue(collateralType)))
        );

        _applyLiquidationToMultiplier(poolId, collateralType, oldShares);

        // send reward
        collateralType.safeTransfer(msg.sender, amountRewarded);

        // TODO: send any remaining collateral to the liquidated account? need to have a liquidation penalty setting or something

        emit Liquidation(accountId, poolId, collateralType, debtLiquidated, collateralLiquidated, amountRewarded);
    }

    function liquidateVault(
        uint poolId,
        address collateralType,
        uint liquidateAsAccountId,
        uint maxUsd
    ) external override returns (uint amountLiquidated, uint collateralRewarded) {
        if (_accountOwner(liquidateAsAccountId) == address(0)) {
            revert InvalidParameters("liquidateAsAccountId", "account is not created");
        }

        if (maxUsd == 0) {
            revert InvalidParameters("maxUsd", "must be higher than 0");
        }

        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];

        int rawVaultDebt = _vaultDebt(poolId, collateralType);

        uint vaultDebt = rawVaultDebt < 0 ? 0 : uint(rawVaultDebt);

        (, uint collateralValue) = _vaultCollateral(poolId, collateralType);

        if (!_isLiquidatable(collateralType, vaultDebt, collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue,
                vaultDebt,
                vaultDebt > 0 ? collateralValue.divDecimal(vaultDebt) : 0,
                _getCollateralMinimumCRatio(collateralType)
            );
        }

        if (vaultDebt < maxUsd) {
            // full vault liquidation
            _getToken(_USD_TOKEN).burn(msg.sender, vaultDebt);

            amountLiquidated = vaultDebt;
            collateralRewarded = uint(vaultData.epochData[vaultData.epoch].collateralDist.totalValue());

            bytes32 vaultActorId = bytes32(uint(uint160(collateralType)));

            // inform the pool that this market is exiting (note the debt has already been rolled into vaultData so no change)
            _poolModuleStore().pools[poolId].debtDist.updateActorShares(vaultActorId, 0);

            // reboot the vault
            vaultData.epoch++;
        } else {
            // partial vault liquidation
            _getToken(_USD_TOKEN).burn(msg.sender, maxUsd);

            VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

            amountLiquidated = maxUsd;
            collateralRewarded = (uint(epochData.collateralDist.totalValue()) * amountLiquidated) / vaultDebt;

            // repay the debt
            epochData.debtDist.distribute(-int(amountLiquidated));
            epochData.unclaimedDebt -= int128(int(amountLiquidated));

            // take away the collateral
            epochData.collateralDist.distribute(-int(collateralRewarded));

            // TODO this is probably wrong
            _applyLiquidationToMultiplier(poolId, collateralType, amountLiquidated.divDecimal(vaultDebt));
        }

        // update the pool (debt was repayed but collateral was taken)
        _poolModuleStore().pools[poolId].totalLiquidity += int128(
            int(amountLiquidated) - int(collateralRewarded.mulDecimal(_getCollateralValue(collateralType)))
        );

        // award the collateral that was just taken to the specified account
        _depositCollateral(liquidateAsAccountId, collateralType, collateralRewarded);

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

        return collateralValue.divDecimal(debt) < _getCollateralMinimumCRatio(collateralType);
    }

    function isLiquidatable(
        uint accountId,
        uint poolId,
        address collateralType
    ) external override returns (bool) {
        int rawDebt = _updateAccountDebt(accountId, poolId, collateralType);
        (, uint collateralValue, ) = _accountCollateral(accountId, poolId, collateralType);
        return rawDebt >= 0 && _isLiquidatable(collateralType, uint(rawDebt), collateralValue);
    }

    function _applyLiquidationToMultiplier(
        uint poolId,
        address collateralType,
        uint liquidatedShares
    ) internal {
        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        uint oldTotalShares = liquidatedShares + epochData.debtDist.totalShares;

        uint newLiquidityMultiplier = (uint(epochData.liquidityMultiplier) * oldTotalShares) /
            epochData.debtDist.totalShares;

        // update totalLiquidity (to stay exact)
        _poolModuleStore().pools[poolId].totalLiquidity = int128(
            _poolModuleStore().pools[poolId].totalLiquidity +
                int(uint(epochData.debtDist.totalShares).mulDecimal(newLiquidityMultiplier)) -
                int(oldTotalShares.mulDecimal(epochData.liquidityMultiplier))
        );

        // update debt adjustments
        epochData.liquidityMultiplier = uint128(newLiquidityMultiplier);
    }
}
