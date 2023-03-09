//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/FeeConfiguration.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";

/**
 * @title Module for buying and selling atomically registered synths.
 * @dev See IAtomicOrderModule.
 */
contract AtomicOrderModule is IAtomicOrderModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buy(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) external override returns (uint synthAmount, int totalFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        // transfer usd from buyer
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        // Calculate fees
        uint256 usdAmountAfterFees;
        (usdAmountAfterFees, totalFees, ) = FeeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY),
            Transaction.Type.BUY
        );

        uint collectedFees = FeeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            Transaction.Type.BUY,
            referrer
        );
        int remainingFees = totalFees - collectedFees.toInt();

        spotMarketFactory.depositToMarketManager(marketId, usdAmountAfterFees);

        // Exchange amount after fees into synths to buyer
        synthAmount = Price.usdSynthExchangeRate(
            marketId,
            usdAmountAfterFees,
            Transaction.Type.BUY
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees, referrer);

        return (synthAmount, totalFees);
    }

    function quoteSell(
        uint128 marketId,
        uint synthAmount
    ) external override returns (uint256 returnAmount, int256 totalFees) {
        SpotMarketFactory.load().isValidMarket(marketId);
        (returnAmount, totalFees) = _getQuote(marketId, synthAmount);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sell(
        uint128 marketId,
        uint256 synthAmount,
        uint minAmountReceived,
        address referrer
    ) external override returns (uint256 returnAmount, int totalFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        (returnAmount, totalFees) = _getQuote(marketId, synthAmount);

        if (returnAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, returnAmount);
        }

        // Burn synths provided
        // Burn after calculation because skew is calculating using total supply prior to fill
        SynthUtil.getToken(marketId).burn(msg.sender, synthAmount);

        uint collectedFees;

        if (totalFees > 0) {
            // withdraw fees
            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );

            // collect fees
            collectedFees = FeeConfiguration.collectFees(
                marketId,
                totalFees,
                msg.sender,
                Transaction.Type.SELL,
                referrer
            );
        }

        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            msg.sender,
            returnAmount
        );

        emit SynthSold(marketId, returnAmount, totalFees, collectedFees, referrer);

        return (returnAmount, totalFees);
    }

    function sellExactOut(
        uint128 marketId,
        uint usdAmount,
        address referrer
    ) external override returns (uint) {
        return usdAmount;
    }

    function sellExactIn(
        uint128 marketId,
        uint synthAmount,
        address referrer
    ) external override returns (uint) {
        return synthAmount;
    }

    function _getQuote(
        uint128 marketId,
        uint synthAmount
    ) private returns (uint256 returnAmount, int256 totalFees) {
        // Exchange synths provided into dollar amount
        uint256 usdAmount = Price.synthUsdExchangeRate(
            marketId,
            synthAmount,
            Transaction.Type.SELL
        );

        // calculate fees
        uint referrerShareableFees;
        (returnAmount, totalFees, referrerShareableFees) = FeeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.SELL),
            Transaction.Type.SELL
        );
    }
}
