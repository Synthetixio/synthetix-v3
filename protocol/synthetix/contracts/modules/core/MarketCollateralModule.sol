//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

import "../../interfaces/IMarketCollateralModule.sol";
import "../../storage/Market.sol";

/**
 * @title Module for allowing markets to directly increase their credit capacity by providing their own collateral.
 * @dev See IMarketCollateralModule.
 */
contract MarketCollateralModule is IMarketCollateralModule {
    using ERC20Helper for address;
    using CollateralConfiguration for CollateralConfiguration.Data;

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function depositMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint256 tokenAmount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        uint256 systemAmount = CollateralConfiguration
            .load(collateralType)
            .convertTokenToSystemAmount(tokenAmount);

        // Ensure the sender is the market address associated with the specified marketId
        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint256 maxDepositable = marketData.maximumDepositableD18[collateralType];
        uint256 depositedCollateralEntryIndex = _findOrCreateDepositEntryIndex(
            marketData,
            collateralType
        );
        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[
            depositedCollateralEntryIndex
        ];

        // Ensure that depositing this amount will not exceed the maximum amount allowed for the market
        if (collateralEntry.amountD18 + systemAmount > maxDepositable)
            revert InsufficientMarketCollateralDepositable(marketId, collateralType, tokenAmount);

        // Transfer the collateral into the system and account for it
        collateralType.safeTransferFrom(marketData.marketAddress, address(this), tokenAmount);
        collateralEntry.amountD18 += systemAmount;

        emit MarketCollateralDeposited(marketId, collateralType, tokenAmount, msg.sender);
    }

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint256 tokenAmount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        uint256 systemAmount = CollateralConfiguration
            .load(collateralType)
            .convertTokenToSystemAmount(tokenAmount);

        // Ensure the sender is the market address associated with the specified marketId
        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint256 depositedCollateralEntryIndex = _findOrCreateDepositEntryIndex(
            marketData,
            collateralType
        );
        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[
            depositedCollateralEntryIndex
        ];

        // Ensure that the market is not withdrawing more collateral than it has deposited
        if (systemAmount > collateralEntry.amountD18) {
            revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, tokenAmount);
        }

        // Transfer the collateral out of the system and account for it
        collateralEntry.amountD18 -= systemAmount;
        collateralType.safeTransfer(marketData.marketAddress, tokenAmount);

        emit MarketCollateralWithdrawn(marketId, collateralType, tokenAmount, msg.sender);
    }

    /**
     * @dev Returns the index of the relevant deposited collateral entry for the given market and collateral type.
     */
    function _findOrCreateDepositEntryIndex(
        Market.Data storage marketData,
        address collateralType
    ) internal returns (uint256 depositedCollateralEntryIndex) {
        Market.DepositedCollateral[] storage depositedCollateral = marketData.depositedCollateral;
        for (uint256 i = 0; i < depositedCollateral.length; i++) {
            Market.DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return i;
            }
        }

        // If this function hasn't returned an index yet, create a new deposited collateral entry and return its index.
        marketData.depositedCollateral.push(Market.DepositedCollateral(collateralType, 0));
        return marketData.depositedCollateral.length - 1;
    }

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function configureMaximumMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint256 amount
    ) external override {
        OwnableStorage.onlyOwner();

        Market.Data storage marketData = Market.load(marketId);
        marketData.maximumDepositableD18[collateralType] = amount;

        emit MaximumMarketCollateralConfigured(marketId, collateralType, amount, msg.sender);
    }

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function getMarketCollateralAmount(
        uint128 marketId,
        address collateralType
    ) external view override returns (uint256 collateralAmountD18) {
        Market.Data storage marketData = Market.load(marketId);
        Market.DepositedCollateral[] storage depositedCollateral = marketData.depositedCollateral;
        for (uint256 i = 0; i < depositedCollateral.length; i++) {
            Market.DepositedCollateral storage depositedCollateralEntry = depositedCollateral[i];
            if (depositedCollateralEntry.collateralType == collateralType) {
                return depositedCollateralEntry.amountD18;
            }
        }
    }

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function getMaximumMarketCollateral(
        uint128 marketId,
        address collateralType
    ) external view override returns (uint256) {
        Market.Data storage marketData = Market.load(marketId);
        return marketData.maximumDepositableD18[collateralType];
    }
}
