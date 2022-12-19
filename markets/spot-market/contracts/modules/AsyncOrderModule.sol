//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrder.sol";
import "../interfaces/IAsyncOrderModule.sol";
import "../utils/AsyncOrderClaimTokenUtil.sol";

/**
 * @title Module with custom NFT logic for the async order claim token
 * @notice TODO
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;
    using AsyncOrder for AsyncOrder.Data;

    function commitBuyOrder(
        uint128 marketId,
        uint256 usdAmount,
        bytes[] calldata priceUpdateData
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrder.AsyncOrderClaim memory asyncOrderClaim)
    {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Accept USD
        uint256 allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < usdAmount) {
            revert InsufficientFunds();
        }
        if (allowance < usdAmount) {
            revert InsufficientAllowance(usdAmount, allowance);
        }
        store.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        // Calculate fees
        (uint256 amountUsable, uint256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Fee.TradeType.ASYNC_BUY
        );

        // Get estimated exchange amount
        uint256 amountSynth = Price.load(marketId).usdSynthExchangeRate(
            marketId,
            amountUsable,
            Fee.TradeType.ASYNC_BUY
        );

        // Mint synths and hold them in this contract as escrow
        SynthUtil.getToken(marketId).mint(address(this), amountSynth);

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        // TODO: Override minimumOrderAge and confirmationWindowDuration if priceUpdataData is provided
        asyncOrderClaim.orderType = Fee.TradeType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = block.timestamp;
        asyncOrderClaim.traderAmountEscrowed = usdAmount;
        asyncOrderClaim.systemAmountEscrowed = amountSynth;
        asyncOrderClaim.feesQuoted = feesQuoted;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        // TODO: Include priceUpdateData
        emit AsyncOrderCommitted(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function commitSellOrder(
        uint128 marketId,
        uint256 synthAmount,
        bytes[] calldata priceUpdateData
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrder.AsyncOrderClaim memory asyncOrderClaim)
    {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Accept Synths
        uint256 allowance = SynthUtil.getToken(marketId).allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < synthAmount) {
            revert InsufficientFunds();
        }
        if (allowance < synthAmount) {
            revert InsufficientAllowance(synthAmount, allowance);
        }
        SynthUtil.getToken(marketId).transferFrom(msg.sender, address(this), synthAmount);

        // Get estimated exchange amount
        uint256 traderAmountEscrowedUsd = Price.load(marketId).usdSynthExchangeRate(
            marketId,
            synthAmount,
            Fee.TradeType.ASYNC_SELL
        );

        // Calculate fees
        (, uint256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            traderAmountEscrowedUsd,
            Fee.TradeType.ASYNC_SELL
        );

        // Withdraw USD and hold in this contract as escrow
        IMarketManagerModule(store.synthetix).withdrawMarketUsd(
            marketId,
            address(this),
            traderAmountEscrowedUsd
        );

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        asyncOrderClaim.orderType = Fee.TradeType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = block.timestamp;
        asyncOrderClaim.traderAmountEscrowed = synthAmount;
        asyncOrderClaim.systemAmountEscrowed = traderAmountEscrowedUsd;
        asyncOrderClaim.feesQuoted = feesQuoted;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        // TODO: Include priceUpdateData
        emit AsyncOrderCommitted(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        bytes[] calldata priceUpdateData
    ) external override returns (uint finalOrderAmount) {
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim = AsyncOrder
            .load(marketId)
            .asyncOrderClaims[asyncOrderId];

        // Ensure we are in the confirmation window
        if (
            block.timestamp <
            asyncOrderClaim.timestamp + AsyncOrder.load(marketId).minimumOrderAge &&
            asyncOrderClaim.timestamp +
                AsyncOrder.load(marketId).minimumOrderAge +
                AsyncOrder.load(marketId).confirmationWindowDuration <
            block.timestamp
        ) {
            revert OutsideOfConfirmationWindow(
                block.timestamp,
                asyncOrderClaim.timestamp,
                AsyncOrder.load(marketId).minimumOrderAge,
                AsyncOrder.load(marketId).confirmationWindowDuration
            );
        }

        // Finalize the order using the provided price data
        if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_BUY) {
            finalOrderAmount = _disburseBuyOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_SELL) {
            finalOrderAmount = _disburseSellOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        }

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        // TODO: Include priceUpdateData
        emit AsyncOrderSettled(
            marketId,
            asyncOrderId,
            asyncOrderClaim,
            finalOrderAmount,
            msg.sender
        );
    }

    function _disburseBuyOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim
    ) private returns (uint finalSynthAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Calculate fees
        (uint256 amountUsable, uint256 feesQuoted) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.traderAmountEscrowed,
            Fee.TradeType.ASYNC_BUY
        );

        // Get the final synth amount
        finalSynthAmount = Price.load(marketId).usdSynthExchangeRate(
            marketId,
            amountUsable,
            Fee.TradeType.ASYNC_BUY
        );

        // Deposit USD
        store.usdToken.approve(address(this), asyncOrderClaim.traderAmountEscrowed);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.traderAmountEscrowed
        );

        // Mint additional synths into escrow if necessary
        if (finalSynthAmount > asyncOrderClaim.traderAmountEscrowed) {
            SynthUtil.getToken(marketId).mint(
                address(this),
                finalSynthAmount - asyncOrderClaim.traderAmountEscrowed
            );
        }

        // Burn additional synths in escrow if necessary
        if (finalSynthAmount < asyncOrderClaim.traderAmountEscrowed) {
            SynthUtil.getToken(marketId).burn(
                address(this),
                asyncOrderClaim.traderAmountEscrowed - finalSynthAmount
            );
        }

        // Transfer final synth amount to claimant
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            finalSynthAmount
        );
    }

    function _disburseSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim
    ) private returns (uint finalUsdAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Get the amount of usd worth the amount of synths provided
        uint256 traderAmountEscrowedUsd = Price.load(marketId).usdSynthExchangeRate(
            marketId,
            asyncOrderClaim.traderAmountEscrowed,
            Fee.TradeType.ASYNC_SELL
        );

        // Calculate fees
        (finalUsdAmount, ) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            traderAmountEscrowedUsd,
            Fee.TradeType.ASYNC_SELL
        );

        // Burn Synths
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.traderAmountEscrowed);

        // Withdraw more USD if necessary
        // TODO: Check if amountWithdrawable is insufficient or it can just revert
        if (finalUsdAmount > asyncOrderClaim.traderAmountEscrowed) {
            IMarketManagerModule(store.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                finalUsdAmount - asyncOrderClaim.traderAmountEscrowed
            );
        }

        // Deposit extra USD in escrow if necessary
        if (finalUsdAmount < asyncOrderClaim.traderAmountEscrowed) {
            store.usdToken.approve(
                address(this),
                asyncOrderClaim.traderAmountEscrowed - finalUsdAmount
            );
            IMarketManagerModule(store.synthetix).depositMarketUsd(
                marketId,
                address(this),
                asyncOrderClaim.traderAmountEscrowed - finalUsdAmount
            );
        }

        // Transfer final USD amount to claimant
        store.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            finalUsdAmount
        );
    }

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim = AsyncOrder
            .load(marketId)
            .asyncOrderClaims[asyncOrderId];

        // Prevent cancellation if this is invoked by someone other than the claimant and the confirmation window hasn't passed
        if (
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId) != msg.sender &&
            block.timestamp <
            asyncOrderClaim.timestamp +
                AsyncOrder.load(marketId).minimumOrderAge +
                AsyncOrder.load(marketId).confirmationWindowDuration
        ) {
            revert InsufficientCancellationTimeElapsed();
        }

        // Return escrowed funds
        if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_BUY) {
            _returnBuyOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_SELL) {
            _returnSellOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        }

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        emit AsyncOrderCancelled(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function _returnBuyOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Return the USD provided, minus the quoted fees
        store.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.traderAmountEscrowed - asyncOrderClaim.feesQuoted
        );

        // Burn the synths escrowed
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.systemAmountEscrowed);

        // Deposit the quoted fees
        store.usdToken.approve(address(this), asyncOrderClaim.feesQuoted);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.feesQuoted
        );
    }

    function _returnSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Return the synths provided, minus the quoted fees
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.traderAmountEscrowed - asyncOrderClaim.feesQuoted
        );

        // Deposit the escrowed USD
        store.usdToken.approve(address(this), asyncOrderClaim.systemAmountEscrowed);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.systemAmountEscrowed
        );

        // Burn quoted fees of synths
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.feesQuoted);
    }
}
