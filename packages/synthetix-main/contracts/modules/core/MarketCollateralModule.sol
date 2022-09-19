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
        uint initalAmountDeposited = marketManagerStore.markets[marketId].depositedCollateral[collateralType];

        if(initalAmountDeposited + amount <= maxDepositable) revert InsufficientMarketCollateralDepositable(marketId, collateralType, amount);

        collateralType.safeTransferFrom(marketManagerStore.markets[marketId].marketAddress, address(this), amount);
        marketManagerStore.markets[marketId].depositedCollateral[collateralType] += amount;

        emit MarketCollateralDeposited(marketId, collateralType, amount, msg.sender);
    }

    function withdrawMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) public override {
        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        uint initalAmountDeposited = marketManagerStore.markets[marketId].depositedCollateral[collateralType];
        if(amount <= initalAmountDeposited) revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, amount);

        collateralType.safeTransfer(marketManagerStore.markets[marketId].marketAddress, amount);
        marketManagerStore.markets[marketId].depositedCollateral[collateralType] -= amount;

        emit MarketCollateralWithdrawn(marketId, collateralType, amount, msg.sender);
    }
}
