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
        SpotMarketFactory.load().isValidMarket(marketId);
        AsyncOrderConfiguration.load(marketId).isValidSettlementStrategy(settlementStrategyId);

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
        asyncOrderId = _mintNft(marketId);

        uint settlementDelay = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[settlementStrategyId]
            .settlementDelay;

        asyncOrderClaim = AsyncOrderClaim.create(
            marketId,
            asyncOrderId,
            orderType,
            amountEscrowed,
            settlementStrategyId,
            block.timestamp + settlementDelay,
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

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external override returns (uint, int, uint) {
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
                    asyncOrderClaim
                );
        } else {
            return _settleOffchain(marketId, asyncOrderId, asyncOrderClaim, settlementStrategy);
        }
    }

    function settleOnChainOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint, int, uint) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy);

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                Price.getCurrentPrice(marketId, asyncOrderClaim.orderType),
                spotMarketFactory,
                asyncOrderClaim
            );
    }

    function settleChainlinkOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy);

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

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                uint(int(median)), // TODO: check this
                SpotMarketFactory.load(),
                asyncOrderClaim
            );
    }

    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy);

        (, bytes[] memory data) = abi.decode(result, (uint8, bytes[]));

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates(
                data,
                priceIds,
                uint64(asyncOrderClaim.settlementTime), // TODO: safe conversion
                uint64(asyncOrderClaim.settlementTime + settlementStrategy.settlementWindowDuration)
            );

        uint publishTime = uint(priceFeeds[0].price.publishTime);

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                uint(int(priceFeeds[0].price.price)), // TODO: check this
                SpotMarketFactory.load(),
                asyncOrderClaim
            );
    }

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.isEligibleForCancellation(
            asyncOrderConfiguration.settlementStrategies[asyncOrderClaim.settlementStrategyId]
        );

        _issueRefund(marketId, asyncOrderId, asyncOrderClaim);
    }

    function _settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        uint price,
        SpotMarketFactory.Data storage spotMarketFactory,
        AsyncOrderClaim.Data storage asyncOrderClaim
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        address trader = AsyncOrderClaimTokenUtil.getNft(marketId).ownerOf(asyncOrderId);

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            (finalOrderAmount, totalFees, collectedFees) = _settleBuyOrder(
                marketId,
                trader,
                price,
                asyncOrderClaim,
                spotMarketFactory
            );
        }

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            (finalOrderAmount, totalFees, collectedFees) = _settleSellOrder(
                marketId,
                trader,
                price,
                asyncOrderClaim,
                spotMarketFactory
            );
        }

        AsyncOrder.adjustCommitmentAmount(marketId, asyncOrderClaim.committedAmountUsd * -1);

        // Burn NFT
        AsyncOrderClaimTokenUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        emit OrderSettled(marketId, asyncOrderId, asyncOrderClaim, finalOrderAmount, msg.sender);
    }

    function _settleBuyOrder(
        uint128 marketId,
        address trader,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SpotMarketFactory.Data storage spotMarketFactory
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        uint amountUsable;
        (amountUsable, totalFees, collectedFees) = FeeUtil.processFees(
            marketId,
            trader,
            asyncOrderClaim.amountEscrowed,
            SpotMarketFactory.TransactionType.BUY
        );

        finalOrderAmount = amountUsable.divDecimal(price);

        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        spotMarketFactory.depositToMarketManager(marketId, amountUsable);

        SynthUtil.getToken(marketId).mint(trader, finalOrderAmount);
    }

    function _settleSellOrder(
        uint128 marketId,
        address trader,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SpotMarketFactory.Data storage spotMarketFactory
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        uint synthAmount = AsyncOrder.load(marketId).convertSharesToSynth(
            marketId,
            asyncOrderClaim.amountEscrowed
        );
        AsyncOrder.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);

        // TODO: AtomicSell is the same, consolidate into OrderUtil? (same for buy above)
        uint usdAmount = synthAmount.mulDecimal(price);

        (finalOrderAmount, totalFees, collectedFees) = FeeUtil.processFees(
            marketId,
            msg.sender,
            usdAmount,
            SpotMarketFactory.TransactionType.SELL
        );

        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            trader,
            usdAmount
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
    }

    function _settleOffchain(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.CHAINLINK) {
            selector = AsyncOrderModule.settleChainlinkOrder.selector;
            urls[0] = _generateChainlinkUrl(settlementStrategy, asyncOrderClaim.settlementTime);
        } else if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderModule.settlePythOrder.selector;
            urls[0] = settlementStrategy.url;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(
                settlementStrategy.feedId,
                _getTimeInBytes(asyncOrderClaim.settlementTime)
            ),
            selector,
            abi.encode(marketId, asyncOrderId)
        );
    }

    function _issueRefund(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim
    ) private {
        INftModule nft = AsyncOrderClaimTokenUtil.getNft(marketId);
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

    function _getTimeInBytes(uint256 settlementTime) private pure returns (bytes8) {
        bytes32 settlementTimeBytes = bytes32(abi.encode(settlementTime));

        // get last 8 bytes
        return bytes8(settlementTimeBytes << 192);
    }

    function _mintNft(uint128 marketId) private returns (uint128 asyncOrderId) {
        INftModule nft = AsyncOrderClaimTokenUtil.getNft(marketId);
        uint256 tokenId = nft.totalSupply();
        asyncOrderId = tokenId.to128();
        nft.mint(msg.sender, tokenId);
    }
}
