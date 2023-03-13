//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/FeeConfiguration.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";

import "hardhat/console.sol";

/**
 * @title Module for buying and selling atomically registered synths.
 * @dev See IAtomicOrderModule.
 */
contract AtomicOrderModule is IAtomicOrderModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using FeeConfiguration for FeeConfiguration.Data;
    using Price for Price.Data;

    function buyExactOut(
        uint128 marketId,
        uint synthAmount,
        uint maxUsdAmount,
        address referrer
    ) external override returns (uint usdAmountCharged, int totalFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(marketId);

        (usdAmountCharged, totalFees, ) = feeConfiguration.calculateFees(
            marketId,
            msg.sender,
            synthAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY_EXACT_OUT),
            Transaction.Type.BUY_EXACT_OUT
        );

        if (usdAmountCharged > maxUsdAmount) {
            revert ExceedsMaxUsdAmount(maxUsdAmount, usdAmountCharged);
        }

        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmountCharged);

        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            spotMarketFactory,
            Transaction.Type.BUY_EXACT_OUT
        );

        // TODO: send to referrer first
        spotMarketFactory.depositToMarketManager(marketId, usdAmountCharged - collectedFees);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees, referrer);

        return (synthAmount, totalFees);
    }

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

        // transfer usd funds
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        // Calculate fees
        uint256 usdAmountAfterFees;
        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(marketId);
        (usdAmountAfterFees, totalFees, ) = feeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.BUY_EXACT_IN),
            Transaction.Type.BUY_EXACT_IN
        );

        synthAmount = Price.usdSynthExchangeRate(
            marketId,
            usdAmountAfterFees,
            Transaction.Type.BUY_EXACT_IN
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            spotMarketFactory,
            Transaction.Type.BUY_EXACT_IN
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmountAfterFees - collectedFees);

        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees, referrer);

        return (synthAmount, totalFees);
    }

    function quoteSell(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 returnAmount, int256 totalFees) {
        SpotMarketFactory.load().isValidMarket(marketId);
        (returnAmount, totalFees, ) = _getQuote(marketId, synthAmount);
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

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(marketId);

        if (totalFees > 0) {
            // withdraw fees
            spotMarketFactory.synthetix.withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );

            // collect fees
            collectedFees = feeConfiguration.collectFees(
                marketId,
                totalFees,
                msg.sender,
                spotMarketFactory,
                Transaction.Type.SELL_EXACT_IN
            );
        }

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, returnAmount);

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
    ) private view returns (uint256 returnAmount, int256 totalFees, uint256 referrerShareableFees) {
        (returnAmount, totalFees, referrerShareableFees) = FeeConfiguration
            .load(marketId)
            .calculateFees(
                marketId,
                msg.sender,
                synthAmount,
                Price.getCurrentPrice(marketId, Transaction.Type.SELL_EXACT_IN),
                Transaction.Type.SELL_EXACT_IN
            );
    }
}
