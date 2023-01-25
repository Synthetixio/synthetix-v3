//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../interfaces/IAsyncOrderModule.sol";
import "../utils/AsyncOrderClaimTokenUtil.sol";
import "../utils/FeeUtil.sol";
import "../interfaces/external/IChainlinkVerifier.sol";
import "../interfaces/external/IPythVerifier.sol";

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
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;

    // ************
    // COMMITMENT
    // ************

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
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );

        if (settlementStrategyId >= asyncOrderConfiguration.settlementStrategies.length) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }

        int256 utilizationDelta;
        uint256 cancellationFee;
        if (orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            // Accept USD (amountProvided is usd)
            uint256 allowance = spotMarketFactory.usdToken.allowance(msg.sender, address(this));
            if (spotMarketFactory.usdToken.balanceOf(msg.sender) < amountProvided) {
                revert InsufficientFunds();
            }
            if (allowance < amountProvided) {
                revert InsufficientAllowance(amountProvided, allowance);
            }
            spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), amountProvided);

            // Calculate fees
            (uint256 amountUsableUsd, int256 estimatedFees) = FeeUtil.calculateFees(
                marketId,
                msg.sender,
                amountProvided,
                SpotMarketFactory.TransactionType.ASYNC_BUY
            );
            cancellationFee = estimatedFees > 0 ? estimatedFees.toUint() : 0;

            // The utilization increases based on the estimated fill
            utilizationDelta = Price
                .usdSynthExchangeRate(
                    marketId,
                    amountUsableUsd,
                    SpotMarketFactory.TransactionType.ASYNC_BUY
                )
                .toInt();
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
            (uint256 estimatedFill, int256 estimatedFees) = FeeUtil.calculateFees(
                marketId,
                msg.sender,
                usdAmount,
                SpotMarketFactory.TransactionType.ASYNC_SELL
            );
            cancellationFee = estimatedFees > 0 ? estimatedFees.toUint() : 0;

            // Decrease the utilization based on the amount remaining after fees
            uint256 synthAmount = Price.usdSynthExchangeRate(
                marketId,
                estimatedFill,
                SpotMarketFactory.TransactionType.SELL
            );
            utilizationDelta = -1 * synthAmount.toInt();
        }

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        uint settlementDelay = asyncOrderConfiguration
            .settlementStrategies[settlementStrategyId]
            .settlementDelay;
        if (settlementDelay == 0) {
            settlementDelay++;
        }

        // Set up order data
        asyncOrderClaim.orderType = orderType;
        asyncOrderClaim.amountEscrowed = amountProvided;
        asyncOrderClaim.settlementStrategyId = settlementStrategyId;
        asyncOrderClaim.settlementTime = block.timestamp + settlementDelay;
        asyncOrderClaim.utilizationDelta = utilizationDelta;
        asyncOrderClaim.cancellationFee = cancellationFee;

        // Accumulate utilization delta for use in fee calculation
        asyncOrderConfiguration.asyncUtilizationDelta += utilizationDelta;

        // Store order data
        AsyncOrderConfiguration.create(marketId, asyncOrderId, asyncOrderClaim);

        // Emit event
        emit OrderCommitted(marketId, orderType, amountProvided, asyncOrderId, msg.sender);
    }

    // ************
    // SETTLEMENT
    // ************

    function settleOrder(uint128 marketId, uint128 asyncOrderId) external override returns (uint) {
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        AsyncOrderClaim.Data memory asyncOrderClaim = asyncOrderConfiguration.asyncOrderClaims[
            asyncOrderId
        ];
        AsyncOrderConfiguration.SettlementStrategy
            memory settlementStrategy = asyncOrderConfiguration.settlementStrategies[
                asyncOrderClaim.settlementStrategyId
            ];

        if (
            settlementStrategy.strategyType ==
            AsyncOrderConfiguration.SettlementStrategyType.ONCHAIN
        ) {
            return settleOnChainOrder(marketId, asyncOrderId);
        } else if (
            settlementStrategy.strategyType ==
            AsyncOrderConfiguration.SettlementStrategyType.CHAINLINK
        ) {
            // TODO
            // revert OffchainData(sender, urls, callData, callbackFunction, extraData)
            // request at asyncOrderClaim.settlementTime
            // callbackFunction = settleChainlinkOrder
        } else if (
            settlementStrategy.strategyType == AsyncOrderConfiguration.SettlementStrategyType.PYTH
        ) {
            // TODO
            // revert OffchainData(sender, urls, callData, callbackFunction, extraData)
            // request at asyncOrderClaim.settlementTime
            // callbackFunction = settlePythOrder
        }
    }

    function settleOnChainOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) public returns (uint finalOrderAmount) {
        (
            AsyncOrderConfiguration.Data storage asyncOrderConfiguration,
            AsyncOrderClaim.Data memory asyncOrderClaim,
            AsyncOrderConfiguration.SettlementStrategy memory settlementStrategy
        ) = _prepareSettlement(marketId, asyncOrderId);

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            finalOrderAmount = Price.usdSynthExchangeRate(
                marketId,
                asyncOrderClaim.amountEscrowed,
                SpotMarketFactory.TransactionType.ASYNC_BUY
            );

            require(
                Price
                    .getCurrentPriceData(marketId, SpotMarketFactory.TransactionType.ASYNC_BUY)
                    .timestamp >= asyncOrderClaim.settlementTime,
                "Needs more recent price report"
            );

            ITokenModule token = SynthUtil.getToken(marketId);
            token.mint(
                AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
                finalOrderAmount
            );
        }

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            finalOrderAmount = Price.synthUsdExchangeRate(
                marketId,
                asyncOrderClaim.amountEscrowed,
                SpotMarketFactory.TransactionType.ASYNC_SELL
            );

            require(
                Price
                    .getCurrentPriceData(marketId, SpotMarketFactory.TransactionType.ASYNC_SELL)
                    .timestamp >= asyncOrderClaim.settlementTime,
                "Needs more recent price report"
            );

            SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
                finalOrderAmount
            );
        }

        _finalizeSettlement(
            marketId,
            asyncOrderId,
            finalOrderAmount,
            asyncOrderConfiguration,
            asyncOrderClaim
        );
    }

    function settleChainlinkOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        bytes memory priceData
    ) external returns (uint finalOrderAmount) {
        (
            AsyncOrderConfiguration.Data storage asyncOrderConfiguration,
            AsyncOrderClaim.Data memory asyncOrderClaim,
            AsyncOrderConfiguration.SettlementStrategy memory settlementStrategy
        ) = _prepareSettlement(marketId, asyncOrderId);

        bytes memory verifierResponse = IChainlinkVerifier(
            settlementStrategy.priceVerificationContract
        ).verify(priceData);

        (
            bytes32 feedID,
            uint32 observationsTimestamp,
            uint64 observationsBlocknumber,
            int192 median
        ) = abi.decode(verifierResponse, (bytes32, uint32, uint64, int192));

        // TODO
        // confirm that observationsTimestamp == asyncOrderClaim.settlementTime
        // need to confirm feedID?

        // price deviation check?

        _finalizeSettlement(
            marketId,
            asyncOrderId,
            finalOrderAmount,
            asyncOrderConfiguration,
            asyncOrderClaim
        );
    }

    function settlePythOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        bytes memory priceData
    ) external returns (uint finalOrderAmount) {
        (
            AsyncOrderConfiguration.Data storage asyncOrderConfiguration,
            AsyncOrderClaim.Data memory asyncOrderClaim,
            AsyncOrderConfiguration.SettlementStrategy memory settlementStrategy
        ) = _prepareSettlement(marketId, asyncOrderId);

        // TODO: does not satisfy interface
        // IPythVerifier(settlementStrategy.priceVerificationContract).parsePriceFeedUpdates(
        //     priceData
        // );

        // TODO
        // confirm that priceData is for asyncOrderClaim.settlementTime
        // confirm the price is for what we want

        // price deviation check?

        _finalizeSettlement(
            marketId,
            asyncOrderId,
            finalOrderAmount,
            asyncOrderConfiguration,
            asyncOrderClaim
        );
    }

    function _prepareSettlement(
        uint128 marketId,
        uint128 asyncOrderId
    )
        internal
        returns (
            AsyncOrderConfiguration.Data storage asyncOrderConfiguration,
            AsyncOrderClaim.Data memory asyncOrderClaim,
            AsyncOrderConfiguration.SettlementStrategy memory settlementStrategy
        )
    {
        asyncOrderConfiguration = AsyncOrderConfiguration.load(marketId);
        asyncOrderClaim = asyncOrderConfiguration.asyncOrderClaims[asyncOrderId];
        settlementStrategy = asyncOrderConfiguration.settlementStrategies[
            asyncOrderClaim.settlementStrategyId
        ];

        // Confirm we're in the settlement window
        require(block.timestamp >= asyncOrderClaim.settlementTime, "too soon");
        if (settlementStrategy.settlementWindowDuration > 0) {
            require(
                asyncOrderClaim.settlementTime + settlementStrategy.settlementWindowDuration <
                    block.timestamp,
                "too late"
            );
        }

        // Collect what's held in escrow
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            _collectBuyOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            _collectSellOrderEscrow(marketId, asyncOrderId, asyncOrderClaim);
        }
    }

    function _finalizeSettlement(
        uint128 marketId,
        uint128 asyncOrderId,
        uint finalOrderAmount,
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) internal {
        // Adjust utilization delta for use in fee calculation
        asyncOrderConfiguration.asyncUtilizationDelta -= asyncOrderClaim.utilizationDelta;

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        emit OrderSettled(marketId, asyncOrderId, asyncOrderClaim, finalOrderAmount, msg.sender);
    }

    function _collectBuyOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();

        // Deposit USD
        // TODO: Add fee collector logic
        spotMarketFactory.usdToken.approve(address(this), asyncOrderClaim.amountEscrowed);
        IMarketManagerModule(spotMarketFactory.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderClaim.amountEscrowed
        );
    }

    function _collectSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();

        // Burn Synths
        // TODO: Add fee collector logic
        SynthUtil.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);
    }

    // ************
    // CANCELLATION
    // ************

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        AsyncOrderClaim.Data memory asyncOrderClaim = asyncOrderConfiguration.asyncOrderClaims[
            asyncOrderId
        ];
        AsyncOrderConfiguration.SettlementStrategy
            memory settlementStrategy = asyncOrderConfiguration.settlementStrategies[
                asyncOrderClaim.settlementStrategyId
            ];
        address marketOwner = SpotMarketFactory.load().marketOwners[marketId];

        bool canAlwaysCancel = AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId) ==
            msg.sender ||
            msg.sender == marketOwner;
        bool confirmationWindowExists = settlementStrategy.settlementWindowDuration > 0;
        bool confirmationWindowClosed = asyncOrderClaim.settlementTime +
            settlementStrategy.settlementWindowDuration <
            block.timestamp;

        // Prevent cancellation if this is invoked by the public and the confirmation window hasn't passed
        if (!canAlwaysCancel && confirmationWindowExists && !confirmationWindowClosed) {
            // TODO: switch to revert here
            require(confirmationWindowClosed, "cannot cancel yet");
        }

        // Return the fee if the market owner is cancelling
        bool shouldReturnFee = msg.sender == marketOwner;

        // Return escrowed funds after keeping the fee
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            _returnBuyOrderEscrow(marketId, asyncOrderId, shouldReturnFee, asyncOrderClaim);
        } else if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            _returnSellOrderEscrow(marketId, asyncOrderId, shouldReturnFee, asyncOrderClaim);
        }

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Adjust utilization delta for use in fee calculation
        asyncOrderConfiguration.asyncUtilizationDelta -= asyncOrderClaim.utilizationDelta;

        // Emit event
        emit OrderCancelled(marketId, asyncOrderId, asyncOrderClaim, msg.sender);
    }

    function _returnBuyOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        bool shouldReturnFee,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );

        // TODO: Confirm negative fee situation
        // TODO: Move feesToCollect into cancelOrder and pass it instead of shouldReturnFee
        uint feesToCollect = shouldReturnFee ? 0 : asyncOrderClaim.cancellationFee;
        uint amountToReturn = asyncOrderClaim.amountEscrowed - feesToCollect;

        // Return the USD
        spotMarketFactory.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            amountToReturn
        );

        FeeUtil.collectFees(
            marketId,
            feesToCollect,
            msg.sender,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );
    }

    function _returnSellOrderEscrow(
        uint128 marketId,
        uint128 asyncOrderId,
        bool shouldReturnFee,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );

        // TODO: Confirm negative fee situation
        // TODO: Move feesToCollect into cancelOrder and pass it instead of shouldReturnFee
        uint feesInUsd = shouldReturnFee ? 0 : asyncOrderClaim.cancellationFee;

        if (feesInUsd > 0) {
            // Calculate the value of the fees in synths
            uint feesInSynths = Price.synthUsdExchangeRate(
                marketId,
                feesInUsd,
                SpotMarketFactory.TransactionType.ASYNC_SELL
            );

            // Return the synths minus this amount
            SynthUtil.transferOutOfEscrow(
                marketId,
                AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
                asyncOrderClaim.amountEscrowed - feesInSynths
            );

            // Burn the fees
            SynthUtil.burnFromEscrow(marketId, feesInSynths);

            // TODO: If there's a fee collector, pull out feesInUsd, run them through the fee collector, and deposit the remainder
        } else {
            // If we're not collecting fees, return them all
            SynthUtil.transferOutOfEscrow(
                marketId,
                AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
                asyncOrderClaim.amountEscrowed
            );
        }
    }
}
