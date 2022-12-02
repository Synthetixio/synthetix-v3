//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

import "../../interfaces/IMarketCollateralModule.sol";
import "../../storage/Market.sol";

contract MarketCollateralModule is IMarketCollateralModule {
    using ERC20Helper for address;

    error InsufficientMarketCollateralDepositable(uint128 marketId, address collateralType, uint amountToDeposit);
    error InsufficientMarketCollateralWithdrawable(uint128 marketId, address collateralType, uint amountToWithdraw);

    function depositMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint maxDepositable = marketData.maximumDepositableD18[collateralType];

        uint collateralEntryIndex = _findOrCreatedepositEntry(marketData, collateralType);

        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[collateralEntryIndex];

        if (collateralEntry.amountD18 + amount > maxDepositable)
            revert InsufficientMarketCollateralDepositable(marketId, collateralType, amount);

        collateralType.safeTransferFrom(marketData.marketAddress, address(this), amount);

        collateralEntry.amountD18 += amount;

        emit MarketCollateralDeposited(marketId, collateralType, amount, msg.sender);
    }

    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint collateralEntryIndex = _findOrCreatedepositEntry(marketData, collateralType);
        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[collateralEntryIndex];

        if (amount > collateralEntry.amountD18) {
            revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, amount);
        }

        collateralEntry.amountD18 -= amount;

        collateralType.safeTransfer(marketData.marketAddress, amount);

        emit MarketCollateralWithdrawn(marketId, collateralType, amount, msg.sender);
    }

    function _findOrCreatedepositEntry(Market.Data storage marketData, address collateralType)
        internal
        returns (uint collateralEntryIndex)
    {
        Market.DepositedCollateral[] storage depositedCollateral = marketData.depositedCollateral;
        for (uint i = 0; i < depositedCollateral.length; i++) {
            Market.DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return i;
            }
        }
        marketData.depositedCollateral.push(Market.DepositedCollateral(collateralType, 0));
        return marketData.depositedCollateral.length - 1;
    }

    function configureMaximumMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external override {
        OwnableStorage.onlyOwner();

        Market.Data storage marketData = Market.load(marketId);
        marketData.maximumDepositableD18[collateralType] = amount;

        emit MaximumMarketCollateralConfigured(marketId, collateralType, amount, msg.sender);
    }

    function getMarketCollateralAmount(uint128 marketId, address collateralType)
        external
        view
        override
        returns (uint collateralAmountD18)
    {
        Market.Data storage marketData = Market.load(marketId);
        Market.DepositedCollateral[] storage depositedCollateral = marketData.depositedCollateral;
        for (uint i = 0; i < depositedCollateral.length; i++) {
            Market.DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return depositedCollateralEntry.amountD18;
            }
        }
    }

    function getMaximumMarketCollateral(uint128 marketId, address collateralType) external view override returns (uint) {
        Market.Data storage marketData = Market.load(marketId);
        return marketData.maximumDepositableD18[collateralType];
    }
}
