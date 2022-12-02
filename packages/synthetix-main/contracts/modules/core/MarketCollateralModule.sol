//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

import "../../interfaces/IMarketCollateralModule.sol";
import "../../storage/Market.sol";

/**
 * @title System module for allowing markets to provide collateral
 */
contract MarketCollateralModule is IMarketCollateralModule {
    using ERC20Helper for address;

    error InsufficientMarketCollateralDepositable(uint128 marketId, address collateralType, uint amountToDeposit);
    error InsufficientMarketCollateralWithdrawable(uint128 marketId, address collateralType, uint amountToWithdraw);

    /**
     * @dev Allows a market to deposit collateral
     */
    function depositMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        // Ensure the sender is the market address associated with the specified marketId
        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint maxDepositable = marketData.maximumDepositableD18[collateralType];
        uint depositedCollateralEntryIndex = _findOrCreateDepositEntryIndex(marketData, collateralType);
        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[depositedCollateralEntryIndex];

        // Ensure that depositing this amount will not exceed the maximum amount allowed for the market
        if (collateralEntry.amountD18 + amount > maxDepositable)
            revert InsufficientMarketCollateralDepositable(marketId, collateralType, amount);

        // Transfer the collateral into the system and account for it
        collateralType.safeTransferFrom(marketData.marketAddress, address(this), amount);
        collateralEntry.amountD18 += amount;

        emit MarketCollateralDeposited(marketId, collateralType, amount, msg.sender);
    }

    /**
     * @dev Allows a market to withdraw collateral that it has previously deposited
     */
    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) public override {
        Market.Data storage marketData = Market.load(marketId);

        // Ensure the sender is the market address associated with the specified marketId
        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        uint depositedCollateralEntryIndex = _findOrCreateDepositEntryIndex(marketData, collateralType);
        Market.DepositedCollateral storage collateralEntry = marketData.depositedCollateral[depositedCollateralEntryIndex];

        // Ensure that the market is not withdrawing more collateral than it has deposited
        if (amount > collateralEntry.amountD18) {
            revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, amount);
        }

        // Transfer the collateral out of the system and account for it
        collateralEntry.amountD18 -= amount;
        collateralType.safeTransfer(marketData.marketAddress, amount);

        emit MarketCollateralWithdrawn(marketId, collateralType, amount, msg.sender);
    }

    /**
     * @dev Returns the index of the relevant deposited collateral entry for the given market and collateral type.
     */
    function _findOrCreateDepositEntryIndex(Market.Data storage marketData, address collateralType)
        internal
        returns (uint depositedCollateralEntryIndex)
    {
        Market.DepositedCollateral[] storage depositedCollateral = marketData.depositedCollateral;
        for (uint i = 0; i < depositedCollateral.length; i++) {
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
     * @dev Allow the system owner to configure the maximum amount of a given collateral type that a specified market is allowed to deposit.
     */
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

    /**
     * @dev Return the total amount of a given collateral type that a specified market has deposited
     */
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

    /**
     * @dev Return the total maximum amount of a given collateral type that a specified market is allowed to deposit
     */
    function getMaximumMarketCollateral(uint128 marketId, address collateralType) external view override returns (uint) {
        Market.Data storage marketData = Market.load(marketId);
        return marketData.maximumDepositableD18[collateralType];
    }
}
