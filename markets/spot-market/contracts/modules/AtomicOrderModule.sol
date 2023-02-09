//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";
import "../utils/FeeUtil.sol";

/**
 * @title Module for buying and selling atomically registered synths.
 * @dev See IAtomicOrderModule.
 */
contract AtomicOrderModule is IAtomicOrderModule {
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
        uint minAmountReceived
    ) external override returns (uint) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        // transfer usd from buyer
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        // Calculate fees
        (uint256 amountUsable, int256 totalFees, uint collectedFees) = FeeUtil.processFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, amountUsable);

        // Exchange amount after fees into synths to buyer
        uint256 synthAmount = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.BUY
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees);

        return synthAmount;
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sell(
        uint128 marketId,
        uint256 synthAmount,
        uint minAmountReceived
    ) external override returns (uint256) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        // Exchange synths provided into dollar amount
        uint256 usdAmount = Price.synthUsdExchangeRate(
            marketId,
            synthAmount,
            SpotMarketFactory.TransactionType.SELL
        );

        // calculate fees
        (uint256 returnAmount, int256 totalFees) = FeeUtil.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.SELL
        );

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
            collectedFees = FeeUtil.collectFees(
                marketId,
                totalFees,
                msg.sender,
                SpotMarketFactory.TransactionType.SELL
            );
        }

        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            msg.sender,
            returnAmount
        );

        emit SynthSold(marketId, returnAmount, totalFees, collectedFees);

        return returnAmount;
    }
}
