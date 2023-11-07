//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../interfaces/IMarketCollateralModule.sol";
import "../../storage/Market.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title Module for allowing markets to directly increase their credit capacity by providing their own collateral.
 * @dev See IMarketCollateralModule.
 */
contract MarketCollateralModule is IMarketCollateralModule {
    using SafeCastU256 for uint256;
    using ERC20Helper for address;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Market for Market.Data;

    bytes32 private constant _DEPOSIT_MARKET_COLLATERAL_FEATURE_FLAG = "depositMarketCollateral";
    bytes32 private constant _WITHDRAW_MARKET_COLLATERAL_FEATURE_FLAG = "withdrawMarketCollateral";

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function depositMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint256 tokenAmount
    ) public override {
        FeatureFlag.ensureAccessToFeature(_DEPOSIT_MARKET_COLLATERAL_FEATURE_FLAG);
        Market.Data storage marketData = Market.load(marketId);

        // Ensure the sender is the market address associated with the specified marketId
        if (ERC2771Context._msgSender() != marketData.marketAddress) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        uint256 systemAmount = CollateralConfiguration
            .load(collateralType)
            .convertTokenToSystemAmount(tokenAmount);

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

        // Account for the collateral and transfer it into the system.
        collateralEntry.amountD18 += systemAmount;
        collateralType.safeTransferFrom(marketData.marketAddress, address(this), tokenAmount);

        emit MarketCollateralDeposited(
            marketId,
            collateralType,
            tokenAmount,
            ERC2771Context._msgSender(),
            marketData.creditCapacityD18,
            marketData.netIssuanceD18,
            marketData.getDepositedCollateralValue(),
            marketData.getReportedDebt()
        );
    }

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint256 tokenAmount
    ) public override {
        FeatureFlag.ensureAccessToFeature(_WITHDRAW_MARKET_COLLATERAL_FEATURE_FLAG);
        Market.Data storage marketData = Market.load(marketId);

        uint256 systemAmount = CollateralConfiguration
            .load(collateralType)
            .convertTokenToSystemAmount(tokenAmount);

        // Ensure the sender is the market address associated with the specified marketId
        if (ERC2771Context._msgSender() != marketData.marketAddress)
            revert AccessError.Unauthorized(ERC2771Context._msgSender());

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

        // Account for transferring out collateral
        collateralEntry.amountD18 -= systemAmount;

        // Ensure that the market is not withdrawing collateral such that it results in a negative getWithdrawableMarketUsd
        int256 newWithdrawableMarketUsd = marketData.creditCapacityD18 +
            marketData.getDepositedCollateralValue().toInt();
        if (newWithdrawableMarketUsd < 0) {
            revert InsufficientMarketCollateralWithdrawable(marketId, collateralType, tokenAmount);
        }

        // Transfer the collateral to the market
        collateralType.safeTransfer(marketData.marketAddress, tokenAmount);

        emit MarketCollateralWithdrawn(
            marketId,
            collateralType,
            tokenAmount,
            ERC2771Context._msgSender(),
            marketData.creditCapacityD18,
            marketData.netIssuanceD18,
            marketData.getDepositedCollateralValue(),
            marketData.getReportedDebt()
        );
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

        emit MaximumMarketCollateralConfigured(
            marketId,
            collateralType,
            amount,
            ERC2771Context._msgSender()
        );
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
    function getMarketCollateralValue(uint128 marketId) external view override returns (uint256) {
        return Market.load(marketId).getDepositedCollateralValue();
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
