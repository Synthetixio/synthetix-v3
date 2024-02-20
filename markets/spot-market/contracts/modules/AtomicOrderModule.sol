//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
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
        uint256 price = Price.getCurrentPrice(
            marketId,
            Transaction.Type.BUY,
            Price.Tolerance.STRICT
        );
        (usdAmountCharged, fees, config) = MarketConfiguration.quoteBuyExactOut(
            marketId,
            synthAmount,
            price,
            ERC2771Context._msgSender(),
            Transaction.Type.BUY
        );

        if (usdAmountCharged > maxUsdAmount) {
            revert ExceedsMaxUsdAmount(maxUsdAmount, usdAmountCharged);
        }

        (uint256 sellUsd, ) = quoteSellExactIn(marketId, synthAmount, Price.Tolerance.STRICT);
        if (sellUsd > usdAmountCharged) {
            revert InvalidPrices();
        }

        spotMarketFactory.usdToken.transferFrom(
            ERC2771Context._msgSender(),
            address(this),
            usdAmountCharged
        );

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            ERC2771Context._msgSender(),
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmountCharged - collectedFees);
        SynthUtil.getToken(marketId).mint(ERC2771Context._msgSender(), synthAmount);

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
        spotMarketFactory.usdToken.transferFrom(
            ERC2771Context._msgSender(),
            address(this),
            usdAmount
        );

        MarketConfiguration.Data storage config;
        uint256 price = Price.getCurrentPrice(
            marketId,
            Transaction.Type.BUY,
            Price.Tolerance.STRICT
        );
        (synthAmount, fees, config) = MarketConfiguration.quoteBuyExactIn(
            marketId,
            usdAmount,
            price,
            ERC2771Context._msgSender(),
            Transaction.Type.BUY
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        (uint256 sellUsd, ) = quoteSellExactIn(marketId, synthAmount, Price.Tolerance.STRICT);
        if (sellUsd > usdAmount) {
            revert InvalidPrices();
        }

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            ERC2771Context._msgSender(),
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmount - collectedFees);
        SynthUtil.getToken(marketId).mint(ERC2771Context._msgSender(), synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer, price);

        return (synthAmount, fees);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteBuyExactIn(
        uint128 marketId,
        uint256 usdAmount,
        Price.Tolerance stalenessTolerance
    ) public view override returns (uint256 synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

        (synthAmount, fees, ) = MarketConfiguration.quoteBuyExactIn(
            marketId,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY, stalenessTolerance),
            ERC2771Context._msgSender(),
            Transaction.Type.BUY
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteBuyExactOut(
        uint128 marketId,
        uint256 synthAmount,
        Price.Tolerance stalenessTolerance
    ) external view override returns (uint256 usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

        (usdAmountCharged, fees, ) = MarketConfiguration.quoteBuyExactOut(
            marketId,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY, stalenessTolerance),
            ERC2771Context._msgSender(),
            Transaction.Type.BUY
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteSellExactIn(
        uint128 marketId,
        uint256 synthAmount,
        Price.Tolerance stalenessTolerance
    ) public view override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

        (returnAmount, fees, ) = MarketConfiguration.quoteSellExactIn(
            marketId,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL, stalenessTolerance),
            ERC2771Context._msgSender(),
            Transaction.Type.SELL
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function quoteSellExactOut(
        uint128 marketId,
        uint256 usdAmount,
        Price.Tolerance stalenessTolerance
    ) external view override returns (uint256 synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.load().validateMarket(marketId);

        (synthToBurn, fees, ) = MarketConfiguration.quoteSellExactOut(
            marketId,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL, stalenessTolerance),
            ERC2771Context._msgSender(),
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
        uint256 price = Price.getCurrentPrice(
            marketId,
            Transaction.Type.SELL,
            Price.Tolerance.STRICT
        );
        (returnAmount, fees, config) = MarketConfiguration.quoteSellExactIn(
            marketId,
            synthAmount,
            price,
            ERC2771Context._msgSender(),
            Transaction.Type.SELL
        );

        if (returnAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, returnAmount);
        }

        (uint256 buySynths, ) = quoteBuyExactIn(marketId, returnAmount, Price.Tolerance.STRICT);
        if (buySynths > synthAmount) {
            revert InvalidPrices();
        }

        // Burn synths provided
        // Burn after calculation because skew is calculating using total supply prior to fill
        SynthUtil.getToken(marketId).burn(ERC2771Context._msgSender(), synthAmount);

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            ERC2771Context._msgSender(),
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(
            marketId,
            ERC2771Context._msgSender(),
            returnAmount
        );

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
        uint256 price = Price.getCurrentPrice(
            marketId,
            Transaction.Type.SELL,
            Price.Tolerance.STRICT
        );
        (synthToBurn, fees, config) = MarketConfiguration.quoteSellExactOut(
            marketId,
            usdAmount,
            price,
            ERC2771Context._msgSender(),
            Transaction.Type.SELL
        );

        if (synthToBurn > maxSynthAmount) {
            revert ExceedsMaxSynthAmount(maxSynthAmount, synthToBurn);
        }

        (uint256 buySynths, ) = quoteBuyExactIn(marketId, usdAmount, Price.Tolerance.STRICT);
        if (buySynths > synthToBurn) {
            revert InvalidPrices();
        }

        SynthUtil.getToken(marketId).burn(ERC2771Context._msgSender(), synthToBurn);
        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            ERC2771Context._msgSender(),
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(
            marketId,
            ERC2771Context._msgSender(),
            usdAmount
        );

        emit SynthSold(marketId, usdAmount, fees, collectedFees, referrer, price);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function getMarketSkew(uint128 marketId) external view returns (int256 marketSkew) {
        return MarketConfiguration.getMarketSkew(marketId);
    }
}
