//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";
import {Price} from "../storage/Price.sol";
import {IAtomicOrderModule} from "../interfaces/IAtomicOrderModule.sol";
import {SynthUtil} from "../utils/SynthUtil.sol";
import {OrderFees} from "../storage/OrderFees.sol";
import {Transaction} from "../utils/TransactionUtil.sol";

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
        uint256 synthAmount,
        uint256 maxUsdAmount,
        address referrer
    ) external override returns (uint256 usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.validateMarket(marketId);

        MarketConfiguration.Data storage config;
        uint256 price = Price.getCurrentPrice(marketId, Transaction.Type.BUY);
        (usdAmountCharged, fees, config) = MarketConfiguration.quoteBuyExactOut(
            marketId,
            synthAmount,
            price,
            msg.sender,
            Transaction.Type.BUY
        );

        if (usdAmountCharged > maxUsdAmount) {
            revert ExceedsMaxUsdAmount(maxUsdAmount, usdAmountCharged);
        }

        (uint sellUsd, ) = quoteSellExactIn(marketId, synthAmount);
        if (sellUsd > usdAmountCharged) {
            revert InvalidPrices();
        }

        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmountCharged);

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmountCharged - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer, price);

        return (synthAmount, fees);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buy(
        uint128 marketId,
        uint256 usdAmount,
        uint256 minAmountReceived,
        address referrer
    ) external override returns (uint256 synthAmount, OrderFees.Data memory fees) {
        return buyExactIn(marketId, usdAmount, minAmountReceived, referrer);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buyExactIn(
        uint128 marketId,
        uint256 usdAmount,
        uint256 minAmountReceived,
        address referrer
    ) public override returns (uint256 synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.validateMarket(marketId);

        // transfer usd funds
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        MarketConfiguration.Data storage config;
        uint256 price = Price.getCurrentPrice(marketId, Transaction.Type.BUY);
        (synthAmount, fees, config) = MarketConfiguration.quoteBuyExactIn(
            marketId,
            usdAmount,
            price,
            msg.sender,
            Transaction.Type.BUY
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        (uint sellUsd, ) = quoteSellExactIn(marketId, synthAmount);
        if (sellUsd > usdAmount) {
            revert InvalidPrices();
        }

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmount - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer, price);

        return (synthAmount, fees);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteBuyExactIn(
        uint128 marketId,
        uint256 usdAmount
    ) public view override returns (uint256 synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

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
        uint256 synthAmount
    ) external view override returns (uint256 usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

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
        uint256 synthAmount
    ) public view override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

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
        uint256 usdAmount
    ) external view override returns (uint256 synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

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
        uint256 synthAmount,
        uint256 minUsdAmount,
        address referrer
    ) external override returns (uint256 usdAmountReceived, OrderFees.Data memory fees) {
        return sellExactIn(marketId, synthAmount, minUsdAmount, referrer);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sellExactIn(
        uint128 marketId,
        uint256 synthAmount,
        uint256 minAmountReceived,
        address referrer
    ) public override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.validateMarket(marketId);

        MarketConfiguration.Data storage config;
        uint256 price = Price.getCurrentPrice(marketId, Transaction.Type.SELL);
        (returnAmount, fees, config) = MarketConfiguration.quoteSellExactIn(
            marketId,
            synthAmount,
            price,
            msg.sender,
            Transaction.Type.SELL
        );

        if (returnAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, returnAmount);
        }

        (uint buySynths, ) = quoteBuyExactIn(marketId, returnAmount);
        if (buySynths > synthAmount) {
            revert InvalidPrices();
        }

        // Burn synths provided
        // Burn after calculation because skew is calculating using total supply prior to fill
        SynthUtil.getToken(marketId).burn(msg.sender, synthAmount);

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, returnAmount);

        emit SynthSold(marketId, returnAmount, fees, collectedFees, referrer, price);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sellExactOut(
        uint128 marketId,
        uint256 usdAmount,
        uint256 maxSynthAmount,
        address referrer
    ) external override returns (uint256 synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.validateMarket(marketId);

        MarketConfiguration.Data storage config;
        uint256 price = Price.getCurrentPrice(marketId, Transaction.Type.SELL);
        (synthToBurn, fees, config) = MarketConfiguration.quoteSellExactOut(
            marketId,
            usdAmount,
            price,
            msg.sender,
            Transaction.Type.SELL
        );

        if (synthToBurn > maxSynthAmount) {
            revert ExceedsMaxSynthAmount(maxSynthAmount, synthToBurn);
        }

        (uint buySynths, ) = quoteBuyExactIn(marketId, usdAmount);
        if (buySynths > synthToBurn) {
            revert InvalidPrices();
        }

        SynthUtil.getToken(marketId).burn(msg.sender, synthToBurn);
        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, usdAmount);

        emit SynthSold(marketId, usdAmount, fees, collectedFees, referrer, price);
    }
}
