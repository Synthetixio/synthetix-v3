//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/ISpotMarketModule.sol";
import "../utils/SynthUtil.sol";

contract SpotMarketModule is ISpotMarketModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using Price for Price.Data;
    using Fee for Fee.Data;

    function buy(uint128 marketId, uint amountUsd) external override returns (int) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        uint256 allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (allowance < amountUsd) {
            revert InsufficientAllowance(amountUsd, allowance);
        }

        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (int256 amountUsable, uint256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountUsd.toInt(),
            Fee.TradeType.BUY
        );

        int256 amountToMint = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.BUY
        );
        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint.toUint());

        // track fees
        // could burn fees/deposit into market manager...
        store.synthFeesCollected[marketId] += feesCollected;

        store.usdToken.approve(address(this), amountUsable.toUint());
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            amountUsable.toUint()
        );

        emit SynthBought(marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint128 marketId, uint256 sellAmount) external override returns (int256) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // TODO: check int256
        int256 amountToWithdraw = Price.load(marketId).synthUsdExchangeRate(
            sellAmount.toInt(),
            Fee.TradeType.SELL
        );
        SynthUtil.getToken(marketId).burn(msg.sender, sellAmount);

        IMarketManagerModule(store.synthetix).withdrawMarketUsd(
            marketId,
            address(this),
            amountToWithdraw.toUint()
        );

        (int256 returnAmount, uint256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountToWithdraw,
            Fee.TradeType.SELL
        );

        store.synthFeesCollected[marketId] += feesCollected;

        store.usdToken.transfer(msg.sender, returnAmount.toUint());
        emit SynthSold(marketId, returnAmount, feesCollected);

        return returnAmount;
    }
}
