//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/MarketConfiguration.sol";
import "../storage/Price.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";

/**
 * @title Module for buying and selling atomically registered synths.
 * @dev See IAtomicOrderModule.
 */
contract AtomicOrderModule is IAtomicOrderModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using MarketConfiguration for MarketConfiguration.Data;

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buyExactOut(
        uint128 marketId,
        uint synthAmount,
        uint maxUsdAmount,
        address referrer
    ) external override returns (uint usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        MarketConfiguration.Data storage config;
        (usdAmountCharged, fees, config) = MarketConfiguration.quoteBuyExactOut(
            marketId,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY),
            msg.sender,
            Transaction.Type.BUY
        );

        if (usdAmountCharged > maxUsdAmount) {
            revert ExceedsMaxUsdAmount(maxUsdAmount, usdAmountCharged);
        }

        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmountCharged);

        uint collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmountCharged - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer);

        return (synthAmount, fees);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buy(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) external override returns (uint synthAmount, OrderFees.Data memory fees) {
        return buyExactIn(marketId, usdAmount, minAmountReceived, referrer);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buyExactIn(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) public override returns (uint synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        // transfer usd funds
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        MarketConfiguration.Data storage config;
        (synthAmount, fees, config) = MarketConfiguration.quoteBuyExactIn(
            marketId,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY),
            msg.sender,
            Transaction.Type.BUY
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        uint collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmount - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer);

        return (synthAmount, fees);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteBuyExactIn(
        uint128 marketId,
        uint usdAmount
    ) external view override returns (uint256 synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (synthAmount, fees, ) = MarketConfiguration.quoteBuyExactIn(
            marketId,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY),
            msg.sender,
            Transaction.Type.BUY
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteBuyExactOut(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (usdAmountCharged, fees, ) = MarketConfiguration.quoteBuyExactOut(
            marketId,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY),
            msg.sender,
            Transaction.Type.BUY
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteSellExactIn(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (returnAmount, fees, ) = MarketConfiguration.quoteSellExactIn(
            marketId,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL),
            msg.sender,
            Transaction.Type.SELL
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteSellExactOut(
        uint128 marketId,
        uint usdAmount
    ) external view override returns (uint256 synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (synthToBurn, fees, ) = MarketConfiguration.quoteSellExactOut(
            marketId,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL),
            msg.sender,
            Transaction.Type.SELL
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sell(
        uint128 marketId,
        uint synthAmount,
        uint minUsdAmount,
        address referrer
    ) external override returns (uint usdAmountReceived, OrderFees.Data memory fees) {
        return sellExactIn(marketId, synthAmount, minUsdAmount, referrer);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sellExactIn(
        uint128 marketId,
        uint256 synthAmount,
        uint minAmountReceived,
        address referrer
    ) public override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        MarketConfiguration.Data storage config;
        (returnAmount, fees, config) = MarketConfiguration.quoteSellExactIn(
            marketId,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL),
            msg.sender,
            Transaction.Type.SELL
        );

        if (returnAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, returnAmount);
        }

        // Burn synths provided
        // Burn after calculation because skew is calculating using total supply prior to fill
        SynthUtil.getToken(marketId).burn(msg.sender, synthAmount);

        uint collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, returnAmount);

        emit SynthSold(marketId, returnAmount, fees, collectedFees, referrer);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sellExactOut(
        uint128 marketId,
        uint usdAmount,
        uint maxSynthAmount,
        address referrer
    ) external override returns (uint synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        MarketConfiguration.Data storage config;
        (synthToBurn, fees, config) = MarketConfiguration.quoteSellExactOut(
            marketId,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL),
            msg.sender,
            Transaction.Type.SELL
        );

        if (synthToBurn > maxSynthAmount) {
            revert ExceedsMaxSynthAmount(maxSynthAmount, synthToBurn);
        }

        SynthUtil.getToken(marketId).burn(msg.sender, synthToBurn);
        uint collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, usdAmount);

        emit SynthSold(marketId, usdAmount, fees, collectedFees, referrer);
    }
}
