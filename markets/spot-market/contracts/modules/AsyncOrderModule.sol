//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../storage/AsyncOrder.sol";
import "../storage/SettlementStrategy.sol";
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
    using AsyncOrder for AsyncOrder.Data;
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;
    using AsyncOrderClaim for AsyncOrderClaim.Data;

    // ************
    // COMMITMENT
    // ************

    function commitOrder(
        uint128 marketId,
        SpotMarketFactory.TransactionType orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim)
    {
<<<<<<< HEAD
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
=======
        SpotMarketFactory.load().isValidMarket(marketId);
        AsyncOrderConfiguration.load(marketId).isValidSettlementStrategy(settlementStrategyId);
>>>>>>> f07aacb2 (some cleanup)

        int256 committedAmountUsd;
        uint amountEscrowed;
        if (orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            SpotMarketFactory.load().usdToken.transferFrom(
                msg.sender,
                address(this),
                amountProvided
            );

            committedAmountUsd = amountProvided.toInt();
            amountEscrowed = amountProvided;
        }

        if (orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            amountEscrowed = AsyncOrder.transferIntoEscrow(marketId, msg.sender, amountProvided);

            // Get the dollar value of the provided synths
            uint256 usdAmount = Price.synthUsdExchangeRate(
                marketId,
                amountProvided,
                SpotMarketFactory.TransactionType.SELL
            );
            committedAmountUsd = -1 * usdAmount.toInt();
        }

        // Issue an async order claim NFT
        asyncOrderId = uint128(AsyncOrderClaimTokenUtil.getNft(marketId).mint(msg.sender));

        asyncOrderClaim = AsyncOrderClaim.create(
            marketId,
            asyncOrderId,
            orderType,
            amountEscrowed,
            settlementStrategyId,
            block.timestamp,
            committedAmountUsd,
            minimumSettlementAmount,
            block.number
        );

        AsyncOrder.adjustCommitmentAmount(marketId, committedAmountUsd);

        // Emit event
        emit OrderCommitted(marketId, orderType, amountProvided, asyncOrderId, msg.sender);
    }

    // ************
    // SETTLEMENT
    // ************

    function settleOrder(uint128 marketId, uint128 asyncOrderId) external override returns (uint) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        if (settlementStrategy.strategyType == SettlementStrategy.Type.ONCHAIN) {
            return
                _settleOrder(
                    marketId,
                    asyncOrderId,
                    Price.getCurrentPrice(marketId, asyncOrderClaim.orderType),
                    spotMarketFactory,
                    asyncOrderClaim,
                    settlementStrategy
                );
        } else {
            return _settleOffchain(marketId, asyncOrderId, asyncOrderClaim, settlementStrategy);
        }
    }

    function settleOnChainOrder(uint128 marketId, uint128 asyncOrderId) external returns (uint) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                Price.getCurrentPrice(marketId, asyncOrderClaim.orderType),
                spotMarketFactory,
                asyncOrderClaim,
                settlementStrategy
            );
    }

    function settleChainlinkOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint finalOrderAmount) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        bytes memory verifierResponse = IChainlinkVerifier(
            settlementStrategy.priceVerificationContract
        ).verify(result);

        (
            bytes32 feedId,
            uint32 observationsTimestamp,
            uint64 observationsBlocknumber,
            int192 median
        ) = abi.decode(verifierResponse, (bytes32, uint32, uint64, int192));

        if (feedId != settlementStrategy.feedId) {
            revert InvalidVerificationResponse();
        }

        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy, observationsTimestamp);

        // price deviation check?

        _settleOrder(
            marketId,
            asyncOrderId,
            uint(int(median)), // TODO: check this
            SpotMarketFactory.load(),
            asyncOrderClaim,
            settlementStrategy
        );
    }

    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint finalOrderAmount) {
        (uint128 marketId, uint asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        // bytes memory verifierResponse = IPythVerifier(
        //     settlementStrategy.priceVerificationContract
        // ).parsePriceFeedUpdates(result);

        // TODO: does not satisfy interface
        // IPythVerifier(settlementStrategy.priceVerificationContract).parsePriceFeedUpdates(
        //     priceData
        // );
        // TODO
        // confirm that priceData is for asyncOrderClaim.settlementTime
        // confirm the price is for what we want
        // price deviation check?

        // _settleOrder()
    }

<<<<<<< HEAD
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

=======
>>>>>>> f07aacb2 (some cleanup)
    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.isEligibleForCancellation(
            asyncOrderConfiguration.settlementStrategies[asyncOrderClaim.settlementStrategyId]
        );

        IAsyncOrderClaimTokenModule nft = AsyncOrderClaimTokenUtil.getNft(marketId);
        address trader = nft.ownerOf(asyncOrderId);
        // Return escrowed funds after keeping the fee
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            ITokenModule(SpotMarketFactory.load().usdToken).transfer(
                trader,
                asyncOrderClaim.amountEscrowed
            );
        } else if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            AsyncOrder.transferFromEscrow(marketId, trader, asyncOrderClaim.amountEscrowed);
        }

        // Burn NFT
        nft.burn(asyncOrderId);

        // Commitment amount accounting
        AsyncOrder.adjustCommitmentAmount(marketId, asyncOrderClaim.committedAmountUsd * -1);

        // Emit event
        emit OrderCancelled(marketId, asyncOrderId, asyncOrderClaim, trader);
    }

    function _settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
<<<<<<< HEAD
<<<<<<< HEAD
        bool shouldReturnFee,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) private {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
=======
=======
        uint256 price,
>>>>>>> 5b89cfe5 (offchain stuff)
        SpotMarketFactory.Data storage spotMarketFactory,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount) {
<<<<<<< HEAD
        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy);
>>>>>>> f07aacb2 (some cleanup)
=======
        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy, block.timestamp);
>>>>>>> 5b89cfe5 (offchain stuff)

        address trader = AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId);

<<<<<<< HEAD
        // Return the USD
        spotMarketFactory.usdToken.transferFrom(
            address(this),
            AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId),
            amountToReturn
        );
=======
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            (uint256 amountUsable, , ) = FeeUtil.processFees(
                marketId,
                trader,
                asyncOrderClaim.amountEscrowed,
                SpotMarketFactory.TransactionType.BUY
            );
>>>>>>> f07aacb2 (some cleanup)

            spotMarketFactory.depositToMarketManager(marketId, amountUsable);

            finalOrderAmount = amountUsable.divDecimal(price);

            // TODO: need explanation on this check
            // require(
            //     Price
            //         .getCurrentPriceData(marketId, SpotMarketFactory.TransactionType.ASYNC_BUY)
            //         .timestamp >= asyncOrderClaim.settlementTime,
            //     "Needs more recent price report"
            // );

            SynthUtil.getToken(marketId).mint(trader, finalOrderAmount);
        }

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            uint synthAmount = AsyncOrder.load(marketId).convertSharesToSynth(
                marketId,
                asyncOrderClaim.amountEscrowed
            );
            AsyncOrder.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);

            // TODO: AtomicSell is the same, consolidate into OrderUtil? (same for buy above)
            uint usdAmount = synthAmount.mulDecimal(price);

            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                trader,
                usdAmount
            );

            (finalOrderAmount, , ) = FeeUtil.processFees(
                marketId,
                msg.sender,
                usdAmount,
                SpotMarketFactory.TransactionType.SELL
            );

            if (finalOrderAmount > usdAmount) {
                IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                    marketId,
                    msg.sender,
                    finalOrderAmount - usdAmount
                );

                ITokenModule(spotMarketFactory.usdToken).transfer(msg.sender, usdAmount);
            } else {
                ITokenModule(spotMarketFactory.usdToken).transfer(msg.sender, finalOrderAmount);
            }

            // TODO: need explanation on this check
            // require(
            //     Price
            //         .getCurrentPriceData(marketId, SpotMarketFactory.TransactionType.ASYNC_SELL)
            //         .timestamp >= asyncOrderClaim.settlementTime,
            //     "Needs more recent price report"
            // );
        }

        _finalizeSettlement(marketId, asyncOrderId, finalOrderAmount, asyncOrderClaim);
    }

    function _finalizeSettlement(
        uint128 marketId,
        uint128 asyncOrderId,
        uint finalOrderAmount,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) internal {
        AsyncOrder.adjustCommitmentAmount(marketId, asyncOrderClaim.committedAmountUsd * -1);

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        emit OrderSettled(marketId, asyncOrderId, asyncOrderClaim, finalOrderAmount, msg.sender);
    }

    function _settleOffchain(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount) {
        string[] memory urls = new string[](1);
        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.CHAINLINK) {
            selector = AsyncOrderModule.settleChainlinkOrder.selector;
            urls[0] = _generateChainlinkUrl(settlementStrategy, asyncOrderClaim.commitmentTime);
        } else if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderModule.settlePythOrder.selector;
            urls[0] = _generatePythUrl(settlementStrategy, asyncOrderClaim.commitmentTime);
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        revert OffchainLookup(
            address(this),
            urls,
            abi.encode(settlementStrategy.feedId),
            selector,
            abi.encode(marketId, asyncOrderId)
        );
    }

    function _generateChainlinkUrl(
        SettlementStrategy.Data storage settlementStrategy,
        uint256 commitmentBlock
    ) private view returns (string memory url) {
        return
            string(
                abi.encodePacked(
                    settlementStrategy.url,
                    "?feedIDStr=",
                    settlementStrategy.feedId,
                    "&L2Blocknumber=",
                    bytes32(commitmentBlock)
                )
            );
    }

    function _generatePythUrl(
        SettlementStrategy.Data storage settlementStrategy,
        uint256 commitmentTime
    ) private view returns (string memory url) {
        return
            string(
                abi.encodePacked(
                    settlementStrategy.url,
                    "?data=",
                    abi.encodePacked(commitmentTime),
                    settlementStrategy.feedId
                )
            );
    }
}
