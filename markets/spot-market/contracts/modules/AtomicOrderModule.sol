//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";

contract AtomicOrderModule is IAtomicOrderModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;

    function buy(uint128 marketId, uint usdAmount) external override returns (uint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Deposit USD from buyer
        store.usdToken.approve(address(this), usdAmount);
        IMarketManagerModule(store.synthetix).depositMarketUsd(marketId, msg.sender, usdAmount);

        // Calculate fees
        (uint256 amountUsable, int256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.BUY
        );

        // Exchange amount after fees into synths to buyer
        uint256 synthAmount = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.BUY
        );
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, feesCollected);

        return synthAmount;
    }

    function sell(uint128 marketId, uint256 synthAmount) external override returns (uint256) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Burn synths provided
        SynthUtil.getToken(marketId).burn(msg.sender, synthAmount);

        // Exchange synths provided into dollar amount
        uint256 usdAmount = Price.synthUsdExchangeRate(
            marketId,
            synthAmount,
            SpotMarketFactory.TransactionType.SELL
        );

        // Calculate fees
        (uint256 returnAmount, int256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.SELL
        );

        // Withdraw USD amount after fees to seller
        IMarketManagerModule(store.synthetix).withdrawMarketUsd(marketId, msg.sender, returnAmount);

        emit SynthSold(marketId, returnAmount, feesCollected);

        return returnAmount;
    }
}
