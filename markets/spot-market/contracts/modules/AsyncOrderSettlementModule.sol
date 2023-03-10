//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../interfaces/IAsyncOrderSettlementModule.sol";
import "../interfaces/external/IChainlinkVerifier.sol";
import "../interfaces/external/IPythVerifier.sol";
import "../storage/AsyncOrderClaim.sol";
import "../storage/SettlementStrategy.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrder.sol";
import "../storage/FeeConfiguration.sol";

/**
 * @title Module to settle asyncronous orders
 * @notice See README.md for an overview of asyncronous orders
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderSettlementModule is IAsyncOrderSettlementModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using AsyncOrder for AsyncOrder.Data;
    using AsyncOrderClaim for AsyncOrderClaim.Data;

    int256 public constant PRECISION = 18;

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external override returns (uint, int, uint) {
        (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performClaimValidityChecks(marketId, asyncOrderId);

        if (settlementStrategy.strategyType == SettlementStrategy.Type.ONCHAIN) {
            return
                _settleOrder(
                    marketId,
                    asyncOrderId,
                    Price.getCurrentPrice(marketId, asyncOrderClaim.orderType),
                    asyncOrderClaim,
                    settlementStrategy
                );
        } else {
            return _settleOffchain(marketId, asyncOrderId, asyncOrderClaim, settlementStrategy);
        }
    }

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external payable returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performClaimValidityChecks(marketId, asyncOrderId);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = result;

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates{value: msg.value}(
            updateData,
            priceIds,
            asyncOrderClaim.settlementTime.to64(),
            (asyncOrderClaim.settlementTime + settlementStrategy.settlementWindowDuration).to64()
        );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        uint offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            Price.getCurrentPrice(marketId, asyncOrderClaim.orderType)
        );

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                offchainPrice,
                asyncOrderClaim,
                settlementStrategy
            );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    /*
    function settleChainlinkOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external override returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performClaimValidityChecks(marketId, asyncOrderId);

        bytes memory verifierResponse = IChainlinkVerifier(
            settlementStrategy.priceVerificationContract
        ).verify(result);

        (
            bytes32 feedId,
            uint32 observationsTimestamp,
            uint64 observationsBlocknumber,
            int192 median // TODO: why is this int192? decimals?
        ) = abi.decode(verifierResponse, (bytes32, uint32, uint64, int192));

        uint offchainPrice = uint(int(median)); // TODO: check this

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            Price.getCurrentPrice(marketId, asyncOrderClaim.orderType)
        );

        if (observationsTimestamp < asyncOrderClaim.settlementTime) {
            revert InvalidVerificationResponse();
        }

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                offchainPrice,
                asyncOrderClaim,
                settlementStrategy
            );
    }
    */

    /**
     * @dev Reusable logic used for settling orders once the appropriate checks are performed in calling functions.
     */
    function _settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        // set settledAt to avoid any potential reentrancy
        asyncOrderClaim.settledAt = block.timestamp;

        if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_BUY) {
            (finalOrderAmount, totalFees, collectedFees) = _settleBuyOrder(
                marketId,
                price,
                asyncOrderClaim,
                settlementStrategy
            );
        }

        if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_SELL) {
            (finalOrderAmount, totalFees, collectedFees) = _settleSellOrder(
                marketId,
                price,
                asyncOrderClaim,
                settlementStrategy
            );
        }

        // Emit event
        emit OrderSettled(
            marketId,
            asyncOrderId,
            finalOrderAmount,
            totalFees, // TODO: should this include settlement reward?
            collectedFees,
            msg.sender
        );
    }

    /**
     * @dev logic for settling a buy order
     */
    function _settleBuyOrder(
        uint128 marketId,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        // remove keeper fee
        uint amountUsable = asyncOrderClaim.amountEscrowed - settlementStrategy.settlementReward;
        address trader = asyncOrderClaim.owner;

        uint usdAmountAfterFees;
        uint referrerShareableFees;
        (usdAmountAfterFees, totalFees, referrerShareableFees) = FeeConfiguration.calculateFees(
            marketId,
            msg.sender,
            amountUsable,
            price,
            Transaction.Type.ASYNC_BUY
        );

        collectedFees = FeeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            Transaction.Type.ASYNC_BUY,
            asyncOrderClaim.referrer
        );
        int remainingFees = totalFees - collectedFees.toInt();

        finalOrderAmount = usdAmountAfterFees.divDecimal(price);

        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        ITokenModule(spotMarketFactory.usdToken).transfer(
            msg.sender,
            settlementStrategy.settlementReward
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmountAfterFees);

        SynthUtil.getToken(marketId).mint(trader, finalOrderAmount);
    }

    /**
     * @dev logic for settling a sell order
     */
    function _settleSellOrder(
        uint128 marketId,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        // get amount of synth from escrow
        // can't use amountEscrowed directly because the token could have decayed
        uint synthAmount = AsyncOrder.load(marketId).convertSharesToSynth(
            marketId,
            asyncOrderClaim.amountEscrowed
        );

        address trader = asyncOrderClaim.owner;

        uint usableAmount = synthAmount.mulDecimal(price) - settlementStrategy.settlementReward;
        uint referrerShareableFees;
        (finalOrderAmount, totalFees, referrerShareableFees) = FeeConfiguration.calculateFees(
            marketId,
            trader,
            usableAmount,
            price,
            Transaction.Type.ASYNC_SELL
        );

        // burn after fee calculation to avoid before/after fill calculations
        AsyncOrder.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);

        // check slippage tolerance
        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        if (totalFees > 0) {
            // withdraw fees
            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );

            // collect fees
            collectedFees = FeeConfiguration.collectFees(
                marketId,
                totalFees,
                msg.sender,
                Transaction.Type.ASYNC_SELL,
                asyncOrderClaim.referrer
            );
        }

        // send keeper it's reward
        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            msg.sender,
            settlementStrategy.settlementReward
        );

        // send trader final amount
        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            trader,
            finalOrderAmount
        );
    }

    /**
     * @dev logic for settling an offchain order
     */
    function _settleOffchain(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.CHAINLINK) {
            //selector = AsyncOrderModule.settleChainlinkOrder.selector;
        } else if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderSettlementModule.settlePythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        // see EIP-3668: https://eips.ethereum.org/EIPS/eip-3668
        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(
                settlementStrategy.feedId,
                _getTimeInBytes(asyncOrderClaim.settlementTime)
            ),
            selector,
            abi.encode(marketId, asyncOrderId) // extraData that gets sent to callback for validation
        );
    }

    function _performClaimValidityChecks(
        uint128 marketId,
        uint128 asyncOrderId
    )
        private
        view
        returns (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        )
    {
        asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.checkClaimValidity();

        settlementStrategy = AsyncOrderConfiguration.load(marketId).settlementStrategies[
            asyncOrderClaim.settlementStrategyId
        ];
        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy);
    }

    function _getTimeInBytes(uint256 settlementTime) private pure returns (bytes8) {
        bytes32 settlementTimeBytes = bytes32(abi.encode(settlementTime));

        // get last 8 bytes
        return bytes8(settlementTimeBytes << 192);
    }

    // borrowed from PythNode.sol
    function _getScaledPrice(int64 price, int32 expo) private pure returns (int256) {
        int256 factor = PRECISION + expo;
        return factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint());
    }
}
