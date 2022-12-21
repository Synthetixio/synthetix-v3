//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
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
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;
    using AsyncOrder for AsyncOrder.Data;

    function commitBuyOrder(
        uint128 marketId,
        uint256 usdAmount
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim)
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
        (uint256 amountUsable, ) = Fee.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Get estimated exchange amount
        uint256 amountSynth = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Mint synths and hold them in this contract as escrow
        SynthUtil.mintToEscrow(marketId, amountSynth);

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        asyncOrderClaim.orderType = SpotMarketFactory.TransactionType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = block.timestamp;
        asyncOrderClaim.synthAmountEscrowed = amountSynth;
        asyncOrderClaim.usdAmountEscrowed = usdAmount;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit AsyncOrderCommitted(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function commitSellOrder(
        uint128 marketId,
        uint256 synthAmount
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim)
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
        SynthUtil.transferIntoEscrow(marketId, msg.sender, synthAmount);

        // Get estimated exchange amount
        uint256 synthAmountEscrowedUsd = Price.usdSynthExchangeRate(
            marketId,
            synthAmount,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // Calculate fees
        // TODO: use `amountUsable` instead of `synthAmountEscrowedUsd`?
        (, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            synthAmountEscrowedUsd,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // Withdraw USD and hold in this contract as escrow
        IMarketManagerModule(store.synthetix).withdrawMarketUsd(
            marketId,
            address(this),
            synthAmountEscrowedUsd
        );

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        asyncOrderClaim.orderType = SpotMarketFactory.TransactionType.ASYNC_BUY;
        asyncOrderClaim.blockNumber = block.number;
        asyncOrderClaim.timestamp = block.timestamp;
        asyncOrderClaim.synthAmountEscrowed = synthAmount;
        asyncOrderClaim.usdAmountEscrowed = synthAmountEscrowedUsd;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit AsyncOrderCommitted(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external override returns (uint finalOrderAmount) {
        AsyncOrder.Data storage marketAsyncOrderData = AsyncOrder.load(marketId);
        AsyncOrderClaim.Data memory asyncOrderClaim = marketAsyncOrderData.asyncOrderClaims[
            asyncOrderId
        ];

        uint priceTimestamp = Price
            .getCurrentPriceData(marketId, asyncOrderClaim.orderType)
            .timestamp;
        bool minimumOrderAgeHasElapsed = asyncOrderClaim.timestamp +
            marketAsyncOrderData.minimumOrderAge <
            priceTimestamp;
        bool confirmationWindowHasElapsed = asyncOrderClaim.timestamp +
            marketAsyncOrderData.minimumOrderAge +
            marketAsyncOrderData.settlementWindowDuration <
            priceTimestamp;
        bool livePriceSettlement = priceTimestamp == 0 &&
            asyncOrderClaim.timestamp + marketAsyncOrderData.minimumOrderAge < block.timestamp &&
            block.timestamp <
            asyncOrderClaim.timestamp +
                marketAsyncOrderData.minimumOrderAge +
                marketAsyncOrderData.settlementWindowDuration -
                marketAsyncOrderData.livePriceSettlementWindowDuration;

        bool canSettle = livePriceSettlement ||
            (minimumOrderAgeHasElapsed && !confirmationWindowHasElapsed);

        // Ensure we are in the confirmation window
        if (!canSettle) {
            revert OutsideOfConfirmationWindow(
                priceTimestamp,
                asyncOrderClaim.timestamp,
                marketAsyncOrderData.minimumOrderAge,
                marketAsyncOrderData.settlementWindowDuration
            );
        }

        // Finalize the order using the provided price data
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            finalOrderAmount = _disburseBuyOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            finalOrderAmount = _disburseSellOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        }

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
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
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private returns (uint finalSynthAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Calculate fees
        (uint256 amountUsable, ) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.usdAmountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Get the final synth amount
        finalSynthAmount = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Deposit USD
        store.usdToken.approve(address(this), asyncOrderClaim.usdAmountEscrowed);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.usdAmountEscrowed
        );

        // Mint additional synths into escrow if necessary
        if (finalSynthAmount > asyncOrderClaim.synthAmountEscrowed) {
            SynthUtil.mintToEscrow(
                marketId,
                finalSynthAmount - asyncOrderClaim.synthAmountEscrowed
            );
        }

        // Burn additional synths in escrow if necessary
        if (finalSynthAmount < asyncOrderClaim.synthAmountEscrowed) {
            SynthUtil.burnFromEscrow(
                marketId,
                asyncOrderClaim.synthAmountEscrowed - finalSynthAmount
            );
        }

        // Transfer final synth amount to claimant
        SynthUtil.transferOutOfEscrow(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            finalSynthAmount
        );
    }

    function _disburseSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private returns (uint finalUsdAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Get the amount of usd worth the amount of synths provided
        uint256 synthAmountEscrowedUsd = Price.usdSynthExchangeRate(
            marketId,
            asyncOrderClaim.synthAmountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // Calculate fees
        (finalUsdAmount, ) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            synthAmountEscrowedUsd,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // Burn Synths
        SynthUtil.burnFromEscrow(marketId, asyncOrderClaim.synthAmountEscrowed);

        // Withdraw more USD if necessary
        // TODO: Special revert if withdrawMarketUsd will revert due to insufficient credit?
        if (finalUsdAmount > asyncOrderClaim.synthAmountEscrowed) {
            IMarketManagerModule(store.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                finalUsdAmount - asyncOrderClaim.synthAmountEscrowed
            );
        }

        // Deposit extra USD in escrow if necessary
        if (finalUsdAmount < asyncOrderClaim.synthAmountEscrowed) {
            store.usdToken.approve(
                address(this),
                asyncOrderClaim.synthAmountEscrowed - finalUsdAmount
            );
            IMarketManagerModule(store.synthetix).depositMarketUsd(
                marketId,
                address(this),
                asyncOrderClaim.synthAmountEscrowed - finalUsdAmount
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
        AsyncOrderClaim.Data memory asyncOrderClaim = AsyncOrder.load(marketId).asyncOrderClaims[
            asyncOrderId
        ];

        // Prevent cancellation if this is invoked by someone other than the claimant and the confirmation window hasn't passed
        if (
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId) != msg.sender &&
            block.timestamp <
            asyncOrderClaim.timestamp +
                AsyncOrder.load(marketId).minimumOrderAge +
                AsyncOrder.load(marketId).settlementWindowDuration
        ) {
            revert InsufficientCancellationTimeElapsed(
                block.timestamp,
                asyncOrderClaim.timestamp,
                AsyncOrder.load(marketId).minimumOrderAge,
                AsyncOrder.load(marketId).settlementWindowDuration
            );
        }

        // Return escrowed funds
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            _returnBuyOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
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
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        (uint returnAmountUsd, int finalFees) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.usdAmountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Return the USD provided, minus the quoted fees
        store.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            returnAmountUsd
        );

        // Burn the synths escrowed
        SynthUtil.burnFromEscrow(marketId, asyncOrderClaim.synthAmountEscrowed);

        // fees should not be negative when buying
        uint finalFeesUint = finalFees.toUint();
        // Deposit the quoted fees
        store.usdToken.approve(address(this), finalFeesUint);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            finalFeesUint
        );
    }

    function _returnSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        (, int finalFees) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.usdAmountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // TODO: should there be additional fees applied if the fee amount is negative so seller
        // isn't getting free call option?
        uint finalFeesUint = finalFees > 0 ? finalFees.toUint() : 0;

        uint finalFeesSynths = Price.usdSynthExchangeRate(
            marketId,
            finalFeesUint,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );
        uint transferableAmount = asyncOrderClaim.usdAmountEscrowed - finalFeesSynths;

        // Return the synths provided, minus the quoted fees
        SynthUtil.transferOutOfEscrow(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            transferableAmount
        );

        // Deposit the escrowed USD
        store.usdToken.approve(address(this), asyncOrderClaim.usdAmountEscrowed);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.usdAmountEscrowed
        );

        if (finalFeesSynths > 0) {
            // Burn quoted fees of synths
            SynthUtil.burnFromEscrow(marketId, finalFeesSynths);
        }
    }
}
