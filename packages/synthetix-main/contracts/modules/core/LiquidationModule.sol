//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ILiquidationModule.sol";
import "../../storage/LiquidationModuleStorage.sol";

import "../../mixins/CollateralMixin.sol";
import "../../mixins/FundMixin.sol";

import "../../utils/ERC20Helper.sol";
import "../../utils/SharesLibrary.sol";

contract LiquidationsModule is ILiquidationModule, LiquidationModuleStorage, CollateralMixin, FundMixin {

    using MathUtil for uint;
    using ERC20Helper for address;
    using SharesLibrary for SharesLibrary.Distribution;

    event Liquidation(uint indexed accountId, uint indexed fundId, address indexed collateralType, uint debtLiquidated, uint collateralLiquidated, uint amountRewarded);

    error IneligibleForLiquidation(uint collateralValue, uint debt, uint currentCRatio, uint cratio);

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
                collateralValue.divDecimal(debtLiquidated), 
                _getCollateralMinimumCRatio(collateralType)
            );
        }

        debtLiquidated = uint(rawDebt);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        // take away all the user's shares. by not giving the user back their portion of collateral, it will be
        // auto split proportionally between all debt holders
        uint oldShares = vaultData.debtDist.getActorShares(bytes32(accountId));
        vaultData.debtDist.updateDistributionActor(bytes32(accountId), 0);
        
        // feed the debt back into the vault
        vaultData.debtDist.distribute(int(debtLiquidated));

        // update debt adjustments
        vaultData.sharesMultiplier = uint128(uint(vaultData.sharesMultiplier).mulDecimal(
            (oldShares + vaultData.debtDist.totalShares) / vaultData.debtDist.totalShares
        ));

        // TODO: adjust global rewards curve to temp lock user's acquired assets


        // clear liquidity item
        liquidityItem.usdMinted = 0;
        liquidityItem.cumulativeDebt = 0;

        liquidityItem.leverage = 0;

        // send reward
        amountRewarded = _getCollateralLiquidationReward(collateralType);
        collateralType.safeTransfer(msg.sender, amountRewarded);

        // TODO: send any remaining collateral to the liquidated account

        emit Liquidation(accountId, fundId, collateralType, debtLiquidated, collateralLiquidated, amountRewarded);
    }


    function liquidateVault(
        uint fundId,
        address collateralType
    ) external override returns (uint amountRewarded, uint collateralLiquidated) {
        // 'classic' style liquidation for entire value, partial liquidation allow
    }

    function _isLiquidatable(
        address collateralType,
        uint debt, 
        uint collateralValue
    ) internal view returns (bool) {
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
}
