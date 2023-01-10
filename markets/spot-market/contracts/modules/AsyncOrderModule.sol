//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../interfaces/IAsyncOrderModule.sol";
import "../utils/AsyncOrderClaimTokenUtil.sol";

/**
 * @title Module to process asyncronous orders
 * @notice See README.md for an overview of asyncronous orders
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;

    function commitOrder(
        uint128 marketId,
        SpotMarketFactory.TransactionType orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim)
    {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );

        require(
            settlementStrategyId < asyncOrderConfiguration.settlementStrategies.length(),
            "Invalid settlement strategy ID"
        );

        int256 utilizationDelta;
        uint256 cancellationFee;
        if (orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            // Accept USD (amountProvided is usd)
            uint256 allowance = store.usdToken.allowance(msg.sender, address(this));
            if (store.usdToken.balanceOf(msg.sender) < amountProvided) {
                revert InsufficientFunds();
            }
            if (allowance < amountProvided) {
                revert InsufficientAllowance(amountProvided, allowance);
            }
            store.usdToken.transferFrom(msg.sender, address(this), amountProvided);

            // Calculate fees
            (uint256 amountUsableUsd, uint256 estimatedFees) = Fee.calculateFees(
                marketId,
                msg.sender,
                amountProvided,
                SpotMarketFactory.TransactionType.ASYNC_BUY
            );
            cancellationFee = estimatedFees;

            // The utilization increases based on the estimated fill
            utilizationDelta = Price.usdSynthExchangeRate(
                marketId,
                amountUsableUsd,
                SpotMarketFactory.TransactionType.ASYNC_BUY
            );
        }

        if (orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            // Accept Synths (amountProvided is synths)
            uint256 allowance = SynthUtil.getToken(marketId).allowance(msg.sender, address(this));
            if (SynthUtil.getToken(marketId).balanceOf(msg.sender) < amountProvided) {
                revert InsufficientFunds();
            }
            if (allowance < amountProvided) {
                revert InsufficientAllowance(amountProvided, allowance);
            }
            SynthUtil.transferIntoEscrow(marketId, msg.sender, amountProvided);

            // Get the dollar value of the provided synths
            uint256 usdAmount = Price.synthUsdExchangeRate(
                marketId,
                amountProvided,
                SpotMarketFactory.TransactionType.SELL
            );

            // Set cancellation fee based on estimation
            (uint256 estimatedFill, uint256 estimatedFees) = Fee.calculateFees(
                marketId,
                msg.sender,
                usdAmount,
                SpotMarketFactory.TransactionType.ASYNC_SELL
            );
            cancellationFee = estimatedFees;

            // Decrease the utilization based on the amount remaining after fees
            uint256 synthAmount = Price.usdSynthExchangeRate(
                marketId,
                estimatedFill,
                SpotMarketFactory.TransactionType.SELL
            );
            utilizationDelta = -synthAmount;
        }

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        // Set up order data
        asyncOrderClaim.orderType = orderType;
        asyncOrderClaim.amountEscrowed = amountProvided;
        asyncOrderClaim.settlementStrategyId = settlementStrategyId;
        asyncOrderClaim.settlementTime =
            block.timestamp +
            asyncOrderConfiguration.settlementStrategies[settlementStrategyId].settlementDelay;
        asyncOrderClaim.utilizationDelta = utilizationDelta;
        asyncOrderClaim.cancellationFee = cancellationFee;

        // Accumulate utilization delta for use in fee calculation
        asyncOrderConfiguration.asyncUtilizationDelta += utilizationDelta;
        // TODO: remember to undo this on cancel + settle

        // Store order data
        AsyncOrderConfiguration.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit OrderCommitted(marketId, orderType, amountProvided, asyncOrderId, msg.sender);
    }

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external override returns (uint finalOrderAmount) {
        AsyncOrderConfiguration.Data storage marketAsyncOrderData = AsyncOrderConfiguration.load(
            marketId
        );
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
            asyncOrderClaim.amountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Get the final synth amount
        finalSynthAmount = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Deposit USD
        // TODO: What about fee collector here?
        store.usdToken.approve(address(this), asyncOrderClaim.amountEscrowed);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.amountEscrowed
        );

        // Mint final synth amount to claimant
        ITokenModule token = SynthUtil.getToken(marketId);
        token.mint(address(this), finalSynthAmount);
    }

    function _disburseSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private returns (uint finalUsdAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Exchange synths provided into dollar amount
        uint256 usdAmount = Price.synthUsdExchangeRate(
            marketId,
            asyncOrderClaim.amountEscrowed,
            SpotMarketFactory.TransactionType.SELL
        );

        // Calculate fees
        (finalUsdAmount, ) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            usdAmount,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // Burn Synths
        SynthUtil.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);

        // Disperse usd
        // TODO: What about fee collector?
        IMarketManagerModule(store.synthetix).withdrawMarketUsd(
            marketId,
            address(this),
            finalUsdAmount
        );
    }

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderClaim.Data memory asyncOrderClaim = AsyncOrderConfiguration
            .load(marketId)
            .asyncOrderClaims[asyncOrderId];

        // Prevent cancellation if this is invoked by someone other than the claimant and the confirmation window hasn't passed
        if (
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId) != msg.sender &&
            block.timestamp <
            asyncOrderClaim.timestamp +
                AsyncOrderConfiguration.load(marketId).minimumOrderAge +
                AsyncOrderConfiguration.load(marketId).settlementWindowDuration
        ) {
            revert InsufficientCancellationTimeElapsed(
                block.timestamp,
                asyncOrderClaim.timestamp,
                AsyncOrderConfiguration.load(marketId).minimumOrderAge,
                AsyncOrderConfiguration.load(marketId).settlementWindowDuration
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
            asyncOrderClaim.amountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        // Return the USD provided, minus the quoted fees
        store.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            returnAmountUsd
        );

        if (finalFees > 0) {
            Fee.collectFees(marketId, finalFees.toUint());
        }
    }

    function _returnSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        // Calculate value of synths in dollars
        uint amountEscrowedInUsd = Price.usdSynthExchangeRate(
            marketId,
            asyncOrderClaim.amountEscrowed,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // Calculate fees (in dollars)
        (, int feesInUsd) = Fee.calculateFees(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            amountEscrowedInUsd,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        uint feesInSynth = 0;
        if (feesInUsd > 0) {
            // Convert fee amount back to synth denominatation
            feesInSynth = Price.synthUsdExchangeRate(
                marketId,
                feesInUsd.toUint(),
                SpotMarketFactory.TransactionType.ASYNC_SELL
            );

            // Burn this amount
            SynthUtil.burnFromEscrow(marketId, feesInSynth);
        }

        // Transfer remainder to nft holder
        SynthUtil.transferOutOfEscrow(
            marketId,
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            asyncOrderClaim.amountEscrowed - feesInSynth
        );
    }
}
