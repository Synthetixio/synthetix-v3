//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../../interfaces/IMarketCollateralModule.sol";
import "../../utils/ERC20Helper.sol";
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

        uint maxDepositable = marketData.maximumDepositable[collateralType];

        uint collateralEntryIndex = _findOrCreateDepositCollateralEntry(marketData, collateralType);

        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[collateralEntryIndex];

        if (collateralEntry.amount + amount > maxDepositable)
            revert InsufficientMarketCollateralDepositable(marketId, collateralType, amount);

        collateralType.safeTransferFrom(marketData.marketAddress, address(this), amount);

        collateralEntry.amount += amount;

        emit MarketCollateralDeposited(marketId, collateralType, amount, msg.sender);
    }

    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint collateralEntryIndex = _findOrCreateDepositCollateralEntry(marketData, collateralType);
        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[collateralEntryIndex];

        if (amount > collateralEntry.amount) {
            revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, amount);
        }

        collateralEntry.amount -= amount;

        collateralType.safeTransfer(marketData.marketAddress, amount);

        emit MarketCollateralWithdrawn(marketId, collateralType, amount, msg.sender);
    }

    function _findOrCreateDepositCollateralEntry(Market.Data storage marketData, address collateralType)
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
        marketData.maximumDepositable[collateralType] = amount;

        emit MaximumMarketCollateralConfigured(marketId, collateralType, amount, msg.sender);
    }

    function getMarketCollateralAmount(uint128 marketId, address collateralType) external view override returns (uint) {
        Market.Data storage marketData = Market.load(marketId);
        Market.DepositedCollateral[] storage depositedCollateral = marketData.depositedCollateral;
        for (uint i = 0; i < depositedCollateral.length; i++) {
            Market.DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return depositedCollateralEntry.amount;
            }
        }
    }

    function getMaximumMarketCollateral(uint128 marketId, address collateralType) external view override returns (uint) {
        Market.Data storage marketData = Market.load(marketId);
        return marketData.maximumDepositable[collateralType];
    }
}
