//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";

/**
 * @title Module for buying and selling atomically registered synths.
 * @dev See IAtomicOrderModule.
 */
contract AtomicOrderModule is IAtomicOrderModule {
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buy(uint128 marketId, uint usdAmount) external override returns (uint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        store.isValidMarket(marketId);

        // transfer usd from buyer
        store.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        // Calculate fees
        (uint256 amountUsable, int256 totalFees, uint collectedFees) = Fee.processFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.BUY
        );

        // TODO: processFees deposits fees into the market manager
        // and so does this, need to consolidate for effeciency
        store.depositToMarketManager(marketId, amountUsable);

        // Exchange amount after fees into synths to buyer
        uint256 synthAmount = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.BUY
        );
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees);

        return synthAmount;
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sell(uint128 marketId, uint256 synthAmount) external override returns (uint256) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        store.isValidMarket(marketId);

        // Exchange synths provided into dollar amount
        uint256 usdAmount = Price.synthUsdExchangeRate(
            marketId,
            synthAmount,
            SpotMarketFactory.TransactionType.SELL
        );

        // Withdraw USD amount
        IMarketManagerModule(store.synthetix).withdrawMarketUsd(marketId, address(this), usdAmount);

        // Calculate fees
        (uint256 returnAmount, int256 totalFees, uint collectedFees) = Fee.processFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.SELL
        );

        // Burn synths provided
        SynthUtil.getToken(marketId).burn(msg.sender, synthAmount);

        if (returnAmount > usdAmount) {
            IMarketManagerModule(store.synthetix).withdrawMarketUsd(
                marketId,
                msg.sender,
                returnAmount - usdAmount
            );

            ITokenModule(store.usdToken).transfer(msg.sender, usdAmount);
        } else {
            ITokenModule(store.usdToken).transfer(msg.sender, returnAmount);
        }

        emit SynthSold(marketId, returnAmount, totalFees, collectedFees);

        return returnAmount;
    }
}
