//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IMarketCollateralModule.sol";
import "../../storage/CollateralStorage.sol";
import "../../storage/MarketManagerStorage.sol";

import "../../utils/ERC20Helper.sol";

contract MarketCollateralModule is
    IMarketCollateralModule,
    CollateralStorage,
    MarketManagerStorage
{
    using ERC20Helper for address;

    error InsufficientMarketCollateralDepositable(uint marketId, address collateralType, uint amountToDeposit);
    error InsufficientMarketCollateralWithdrawable(uint marketId, address collateralType, uint amountToWithdraw);

    function depositMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) public override {
        CollateralStore storage collateralStore = _collateralStore();
        uint maxDepositable = collateralStore.collateralConfigurations[collateralType].maximumMarketDepositable[marketId];

        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        DepositedCollateral storage collateralEntry = _findDepositCollateralEntry(marketManagerStore.markets[marketId].depositedCollateral, collateralType);

        if(collateralEntry.collateralType == address(0)){
            marketManagerStore.markets[marketId].depositedCollateral.push(DepositedCollateral(collateralType,0));
            collateralEntry = marketManagerStore.markets[marketId].depositedCollateral[marketManagerStore.markets[marketId].depositedCollateral.length - 1];
        }

        if(collateralEntry.amount + amount <= maxDepositable) revert InsufficientMarketCollateralDepositable(marketId, collateralType, amount);

        collateralType.safeTransferFrom(marketManagerStore.markets[marketId].marketAddress, address(this), amount);

        collateralEntry.amount += amount;

        emit MarketCollateralDeposited(marketId, collateralType, amount, msg.sender);
    }

    function withdrawMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) public override {
        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        DepositedCollateral storage collateralEntry = _findDepositCollateralEntry(marketManagerStore.markets[marketId].depositedCollateral, collateralType);

        if(amount <= collateralEntry.amount) revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, amount);

        collateralType.safeTransfer(marketManagerStore.markets[marketId].marketAddress, amount);

        collateralEntry.amount -= amount;

        emit MarketCollateralWithdrawn(marketId, collateralType, amount, msg.sender);
    }

    function _findDepositCollateralEntry(DepositedCollateral[] storage depositedCollateral, address collateralType) internal returns (DepositedCollateral storage) {
        for (uint i = 0; i < depositedCollateral.length; i++) {
            DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if(depositedCollateralEntry.collateralType == collateralType){
                return depositedCollateralEntry;
            }
        }
    }
}
