//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../../storage/SpotMarketFactory.sol";
import "../../interfaces/ISpotMarketModule.sol";
import "../../utils/SynthUtil.sol";

contract SpotMarketModule is ISpotMarketModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;

    error InsufficientFunds();
    error InsufficientAllowance(uint expected, uint current);

    function buy(uint128 marketId, uint amountUsd) external override returns (uint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        uint allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (allowance < amountUsd) {
            revert InsufficientAllowance(amountUsd, allowance);
        }

        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (uint amountUsable, uint feesCollected) = store.getFeeData(marketId).calculateFees(
            msg.sender,
            amountUsd,
            Fee.TradeType.BUY
        );

        uint amountToMint = store.getPriceData(marketId).usdSynthExchangeRate(amountUsable);
        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint);

        // track fees
        // could burn fees/deposit into market manager...
        store.synthFeesCollected[marketId] += feesCollected;

        store.usdToken.approve(address(this), amountUsable);
        IMarketManagerModule(store.synthetix).depositMarketUsd(store.marketId, address(this), amountUsable);

        emit SynthBought(marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint128 marketId, uint sellAmount) external override returns (uint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        uint amountToWithdraw = store.getPriceData(marketId).synthUsdExchangeRate(sellAmount);
        SynthUtil.getToken(marketId).burn(msg.sender, sellAmount);

        IMarketManagerModule(store.synthetix).withdrawUsd(marketId, address(this), amountToWithdraw);

        IMarketManagerModule(store.synthetix).withdrawMarketUsd(store.marketId, address(this), amountToWithdraw);

        store.synthFeesCollected[marketId] += feesCollected;

        store.usdToken.transfer(msg.sender, returnAmount);
        emit SynthSold(marketId, returnAmount, feesCollected);

        return returnAmount;
    }

    function getBuyQuote(uint128 marketId, uint amountUsd) external view override returns (uint, uint) {
        return SpotMarketFactory.load().getFeeData(marketId).calculateFees(msg.sender, amountUsd, Fee.TradeType.BUY);
    }

    function getSellQuote(uint128 marketId, uint amountSynth) external view override returns (uint, uint) {
        return SpotMarketFactory.load().getFeeData(marketId).calculateFees(msg.sender, amountSynth, Fee.TradeType.SELL);
    }
}
