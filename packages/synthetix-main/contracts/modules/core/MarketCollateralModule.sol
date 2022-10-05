//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../../interfaces/IMarketCollateralModule.sol";
import "../../storage/CollateralStorage.sol";
import "../../storage/MarketManagerStorage.sol";

import "../../utils/ERC20Helper.sol";

contract MarketCollateralModule is IMarketCollateralModule, CollateralStorage, MarketManagerStorage, OwnableMixin {
    using ERC20Helper for address;

    error InsufficientMarketCollateralDepositable(uint marketId, address collateralType, uint amountToDeposit);
    error InsufficientMarketCollateralWithdrawable(uint marketId, address collateralType, uint amountToWithdraw);

    function depositMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) public override {
        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        uint maxDepositable = marketManagerStore.markets[marketId].maximumDepositable[collateralType];

        uint collateralEntryIndex = _findOrCreateDepositCollateralEntry(marketId, marketManagerStore, collateralType);

        DepositedCollateral storage collateralEntry = marketManagerStore.markets[marketId].depositedCollateral[
            collateralEntryIndex
        ];

        if (collateralEntry.amount + amount > maxDepositable)
            revert InsufficientMarketCollateralDepositable(marketId, collateralType, amount);

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
        uint collateralEntryIndex = _findOrCreateDepositCollateralEntry(marketId, marketManagerStore, collateralType);
        DepositedCollateral storage collateralEntry = marketManagerStore.markets[marketId].depositedCollateral[
            collateralEntryIndex
        ];

        if (amount < collateralEntry.amount)
            revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, amount);

        collateralType.safeTransfer(marketManagerStore.markets[marketId].marketAddress, amount);

        collateralEntry.amount -= amount;

        emit MarketCollateralWithdrawn(marketId, collateralType, amount, msg.sender);
    }

    function _findOrCreateDepositCollateralEntry(
        uint marketId,
        MarketManagerStore storage marketManagerStore,
        address collateralType
    ) internal returns (uint collateralEntryIndex) {
        DepositedCollateral[] storage depositedCollateral = marketManagerStore.markets[marketId].depositedCollateral;
        for (uint i = 0; i < depositedCollateral.length; i++) {
            DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return i;
            }
        }
        marketManagerStore.markets[marketId].depositedCollateral.push(DepositedCollateral(collateralType, 0));
        return marketManagerStore.markets[marketId].depositedCollateral.length - 1;
    }

    function configureMaximumMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) external override onlyOwner {
        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        marketManagerStore.markets[marketId].maximumDepositable[collateralType] = amount;

        emit MaximumMarketCollateralConfigured(marketId, collateralType, amount, msg.sender);
    }

    function getMarketCollateralAmount(uint marketId, address collateralType) external view override returns (uint) {
        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        DepositedCollateral[] storage depositedCollateral = marketManagerStore.markets[marketId].depositedCollateral;
        for (uint i = 0; i < depositedCollateral.length; i++) {
            DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return depositedCollateralEntry.amount;
            }
        }
    }

    function getMaximumMarketCollateral(uint marketId, address collateralType) external view override returns (uint) {
        MarketManagerStore storage marketManagerStore = _marketManagerStore();
        return marketManagerStore.markets[marketId].maximumDepositable[collateralType];
    }
}
