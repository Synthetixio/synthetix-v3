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

    function buy(uint128 marketId, uint amountUsd) external override returns (uint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        uint256 allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (allowance < amountUsd) {
            revert InsufficientAllowance(amountUsd, allowance);
        }

        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (uint256 amountUsable, uint256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountUsd,
            Fee.TradeType.BUY
        );

        uint256 amountToMint = Price.load(marketId).usdSynthExchangeRate(
            marketId,
            amountUsable,
            Fee.TradeType.BUY
        );
        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint);

        // track fees
        // could burn fees/deposit into market manager...
        store.synthFeesCollected[marketId] += feesCollected;

        store.usdToken.approve(address(this), amountUsable);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            amountUsable
        );

        emit SynthBought(marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint128 marketId, uint256 sellAmount) external override returns (uint256) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // TODO: check int256
        uint256 amountToWithdraw = Price.load(marketId).synthUsdExchangeRate(
            marketId,
            sellAmount,
            Fee.TradeType.SELL
        );
        SynthUtil.getToken(marketId).burn(msg.sender, sellAmount);

        IMarketManagerModule(store.synthetix).withdrawMarketUsd(
            marketId,
            address(this),
            amountToWithdraw
        );

        (uint256 returnAmount, uint256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountToWithdraw,
            Fee.TradeType.SELL
        );

        store.synthFeesCollected[marketId] += feesCollected;

        store.usdToken.transfer(msg.sender, returnAmount);
        emit SynthSold(marketId, returnAmount, feesCollected);

        return returnAmount;
    }
}
