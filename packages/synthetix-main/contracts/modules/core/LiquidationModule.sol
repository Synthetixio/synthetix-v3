//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ILiquidationModule.sol";
import "../../storage/LiquidationModuleStorage.sol";

import "../../mixins/CollateralMixin.sol";
import "../../mixins/FundMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../utils/ERC20Helper.sol";
import "../../utils/SharesLibrary.sol";


contract LiquidationsModule is ILiquidationModule, LiquidationModuleStorage, AssociatedSystemsMixin, CollateralMixin, FundMixin, AccountRBACMixin {

    using MathUtil for uint;
    using ERC20Helper for address;
    using SharesLibrary for SharesLibrary.Distribution;

    event Liquidation(uint indexed accountId, uint indexed fundId, address indexed collateralType, uint debtLiquidated, uint collateralLiquidated, uint amountRewarded);
    event VaultLiquidation(uint indexed fundId, address indexed collateralType, uint debtLiquidated, uint collateralLiquidated, uint amountRewarded);

    error IneligibleForLiquidation(uint collateralValue, uint debt, uint currentCRatio, uint cratio);

    error MustBeVaultLiquidated();

    bytes32 private constant _USD_TOKEN = "USDToken";

    function liquidate(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (uint amountRewarded, uint debtLiquidated, uint collateralLiquidated) {
        int rawDebt = _updateAccountDebt(accountId, fundId, collateralType);

        (uint cl, uint collateralValue,) = _accountCollateral(accountId, fundId, collateralType);
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

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        uint oldShares = vaultData.debtDist.getActorShares(bytes32(accountId));

        if (vaultData.debtDist.totalShares == oldShares) {
            // will be left with 0 shares, which can't be socialized
            revert MustBeVaultLiquidated();
        }

        // take away all the user's shares. by not giving the user back their portion of collateral, it will be
        // auto split proportionally between all debt holders
        vaultData.debtDist.updateDistributionActor(bytes32(accountId), 0);
        
        // feed the debt back into the vault
        vaultData.debtDist.distribute(int(debtLiquidated));

        _applyLiquidationToMultiplier(fundId, collateralType, oldShares);

        // TODO: adjust global rewards curve to temp lock user's acquired assets


        // clear liquidity item
        liquidityItem.usdMinted = 0;
        liquidityItem.cumulativeDebt = 0;

        liquidityItem.leverage = 0;

        // send reward
        amountRewarded = _getCollateralLiquidationReward(collateralType);
        vaultData.totalCollateral -= uint128(amountRewarded);
        collateralType.safeTransfer(msg.sender, amountRewarded);

        // TODO: send any remaining collateral to the liquidated account? need to have a liquidation penalty setting or something

        emit Liquidation(accountId, fundId, collateralType, debtLiquidated, collateralLiquidated, amountRewarded);
    }


    function liquidateVault(
        uint fundId,
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

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        int rawVaultDebt = _vaultDebt(fundId, collateralType);
        
        uint vaultDebt = rawVaultDebt < 0 ? 0 : uint(rawVaultDebt);
        
        uint collateralValue = uint(vaultData.totalCollateral).mulDecimal(_getCollateralValue(collateralType));

        if (!_isLiquidatable(collateralType, vaultDebt, collateralValue)) {
            revert IneligibleForLiquidation(
                collateralValue, 
                vaultDebt, 
                vaultDebt > 0 ? collateralValue.divDecimal(vaultDebt) : 0, 
                _getCollateralMinimumCRatio(collateralType)
            );
        }

        amountLiquidated = vaultDebt < maxUsd ? vaultDebt : maxUsd;
        collateralRewarded = vaultData.totalCollateral * amountLiquidated / vaultDebt;

        // pull in USD
        _getToken(_USD_TOKEN).burn(msg.sender, amountLiquidated);


        // repay the debt
        vaultData.debtDist.distribute(-int(amountLiquidated));
        vaultData.totalDebt = vaultData.totalDebt - int128(int(amountLiquidated));

        // take away the collateral
        vaultData.totalCollateral -= uint128(collateralRewarded);

        // award the collateral that was just taken to the specified account
        _depositCollateral(liquidateAsAccountId, collateralType, collateralRewarded);

        // final fund cleanup
        if (vaultData.totalCollateral == 0) {
            vaultData.debtDist.totalShares = 0;
            vaultData.liquidityMultiplier = 0;
        }

        // TODO: apply locking curve

        emit VaultLiquidation(fundId, collateralType, amountLiquidated, collateralRewarded, collateralRewarded);
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
        uint fundId,
        address collateralType
    ) external override returns (bool) {
        int rawDebt = _updateAccountDebt(accountId, fundId, collateralType);
        (,uint collateralValue,) = _accountCollateral(accountId, fundId, collateralType);
        return rawDebt >= 0 &&  _isLiquidatable(collateralType, uint(rawDebt), collateralValue);
    }

    function _applyLiquidationToMultiplier(uint fundId, address collateralType, uint liquidatedShares) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        uint oldTotalShares = liquidatedShares + vaultData.debtDist.totalShares;

        uint newliquidityMultiplier = uint(vaultData.liquidityMultiplier).mulDecimal(
            oldTotalShares / vaultData.debtDist.totalShares
        );

        // update totalLiquidity (to stay exact)
        _fundModuleStore().funds[fundId].totalLiquidity = 
            uint128(uint(_fundModuleStore().funds[fundId].totalLiquidity) +
            uint(vaultData.debtDist.totalShares).mulDecimal(newliquidityMultiplier) -
            oldTotalShares.mulDecimal(vaultData.liquidityMultiplier));

        // update debt adjustments
        vaultData.liquidityMultiplier = uint128(newliquidityMultiplier);
    }
}
