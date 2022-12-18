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

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitBuyOrder(
        uint128 marketId,
        uint256 usdAmount
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
        (uint256 amountUsable, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Fee.TradeType.ASYNC_BUY
        );

        // Get estimated exchange amount
        uint256 amountSynth = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.ASYNC_BUY
        );

        // Mint synths and hold them in this contract as escrow
        SynthUtil.getToken(marketId).mint(address(this), amountSynth);

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        asyncOrderClaim.orderType = Fee.TradeType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = block.timestamp;
        asyncOrderClaim.amountProvided = usdAmount;
        asyncOrderClaim.amountStaged = amountSynth;
        asyncOrderClaim.feesQuoted = feesQuoted;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit AsyncOrderCommitted(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitSellOrder(
        uint128 marketId,
        uint256 synthAmount
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
        uint256 amountProvidedUsd = Price.load(marketId).usdSynthExchangeRate(
            synthAmount,
            Fee.TradeType.ASYNC_SELL
        );

        // Calculate fees
        (, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountProvidedUsd,
            Fee.TradeType.ASYNC_SELL
        );

        // Withdraw USD and hold in this contract as escrow
        IMarketManagerModule(store.synthetix).withdrawMarketUsd(
            marketId,
            address(this),
            amountProvidedUsd
        );

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        asyncOrderClaim.orderType = Fee.TradeType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = block.timestamp;
        asyncOrderClaim.amountProvided = synthAmount;
        asyncOrderClaim.amountStaged = amountProvidedUsd;
        asyncOrderClaim.feesQuoted = feesQuoted;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit AsyncOrderCommitted(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        bytes memory priceData
    ) external override returns (uint finalOrderAmount) {
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim = AsyncOrder
            .load(marketId)
            .asyncOrderClaims[asyncOrderId];

        // Ensure delay has occured
        if (
            block.timestamp < asyncOrderClaim.timestamp + AsyncOrder.load(marketId).minimumOrderAge
        ) {
            revert InsufficientSettlementTimeElapsed(
                block.timestamp,
                asyncOrderClaim.timestamp,
                AsyncOrder.load(marketId).minimumOrderAge
            );
        }

        // Finalize the order using the provided price data
        if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_BUY) {
            finalOrderAmount = _disburseBuyOrderEscrow(
                marketId,
                asyncOrderId,
                asyncOrderClaim,
                priceData
            );
        } else if (asyncOrderClaim.orderType == Fee.TradeType.ASYNC_SELL) {
            finalOrderAmount = _disburseSellOrderEscrow(
                marketId,
                asyncOrderId,
                asyncOrderClaim,
                priceData
            );
        }

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        // TODO: pricedata in here? Or identifying the source, node id?
        emit AsyncOrderSettled(
            marketId,
            asyncOrderId,
            asyncOrderClaim,
            finalOrderAmount,
            msg.sender
        );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function _disburseBuyOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim,
        bytes memory priceData
    ) private returns (uint finalSynthAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Calculate fees
        (uint256 amountUsable, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.amountProvided,
            Fee.TradeType.ASYNC_BUY
        );

        // Get the final synth amount
        finalSynthAmount = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.ASYNC_BUY
            //priceData // TODO: gotta figure out how this will work
        );

        // Deposit USD
        store.usdToken.approve(address(this), asyncOrderClaim.amountProvided);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.amountProvided
        );

        // Mint additional synths into escrow if necessary
        if (finalSynthAmount > asyncOrderClaim.amountProvided) {
            SynthUtil.getToken(marketId).mint(
                address(this),
                finalSynthAmount - asyncOrderClaim.amountProvided
            );
        }

        // Burn additional synths in escrow if necessary
        if (finalSynthAmount < asyncOrderClaim.amountProvided) {
            SynthUtil.getToken(marketId).burn(
                address(this),
                asyncOrderClaim.amountProvided - finalSynthAmount
            );
        }

        // Transfer final synth amount to claimant
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            finalSynthAmount
        );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function _disburseSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim,
        bytes memory priceData
    ) private returns (uint finalUsdAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Get the amount of usd worth the amount of synths provided
        uint256 amountProvidedUsd = Price.load(marketId).usdSynthExchangeRate(
            asyncOrderClaim.amountProvided,
            Fee.TradeType.ASYNC_SELL
            //priceData // TODO: gotta figure out how this will work
        );

        // Calculate fees
        (finalUsdAmount, ) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            amountProvidedUsd,
            Fee.TradeType.ASYNC_SELL
        );

        // Burn Synths
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.amountProvided);

        // Withdraw more USD if necessary
        // TODO: Check if amountWithdrawable is insufficient
        if (finalUsdAmount > asyncOrderClaim.amountProvided) {
            IMarketManagerModule(store.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                finalUsdAmount - asyncOrderClaim.amountProvided
            );
        }

        // Deposit extra USD in escrow if necessary
        if (finalUsdAmount < asyncOrderClaim.amountProvided) {
            store.usdToken.approve(address(this), asyncOrderClaim.amountProvided - finalUsdAmount);
            IMarketManagerModule(store.synthetix).depositMarketUsd(
                marketId,
                address(this),
                asyncOrderClaim.amountProvided - finalUsdAmount
            );
        }

        // Transfer final USD amount to claimant
        store.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            finalUsdAmount
        );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrder.AsyncOrderClaim memory asyncOrderClaim = AsyncOrder
            .load(marketId)
            .asyncOrderClaims[asyncOrderId];

        // Prevent cancellation if this is invoked by someone other than the claimant and the minimum order time plus the external cancellation buffer time hasn't elapsed
        if (
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId) != msg.sender &&
            block.timestamp <
            asyncOrderClaim.timestamp +
                AsyncOrder.load(marketId).minimumOrderAge +
                AsyncOrder.load(marketId).forcedCancellationDelay
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

    /**
     * @inheritdoc IAsyncOrderModule
     */
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
            asyncOrderClaim.amountProvided - asyncOrderClaim.feesQuoted
        );

        // Burn the synths escrowed
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.amountStaged);

        // Deposit the quoted fees
        store.usdToken.approve(address(this), asyncOrderClaim.feesQuoted);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.feesQuoted
        );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
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
            asyncOrderClaim.amountProvided - asyncOrderClaim.feesQuoted
        );

        // Deposit the escrowed USD
        store.usdToken.approve(address(this), asyncOrderClaim.amountStaged);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.amountStaged
        );

        // Burn quoted fees of synths
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderClaim.feesQuoted);
    }
}
