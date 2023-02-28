//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAsyncOrderModule.sol";
import "../storage/AsyncOrder.sol";
import "../storage/Position.sol";
import "../storage/Price.sol";

contract AsyncOrderModule is IAsyncOrderModule {
    using Position for Position.Data;
    using AsyncOrder for AsyncOrder.Data;

    function commitOrder(
        uint128 marketId,
        uint128 accountId,
        int256 sizeDelta,
        uint256 settlementStrategyId,
        uint256 acceptablePrice,
        bytes32 trackingCode
    ) external override returns (AsyncOrder.Data memory retOrder, uint fees) {
        /*
            1. check valid market
            2. check valid account
            3. check valid settlement strategy
        */

        // TODO: recompute funding

        AsyncOrder.Data storage order = PerpsMarket.load(marketId).asyncOrders[accountId];

        SettlementStrategy.Data storage strategy = MarketConfiguration
            .load(marketId)
            .settlementStrategies[settlementStrategyId];

        order.update(
            sizeDelta,
            settlementStrategyId,
            block.timestamp + strategy.settlementDelay,
            acceptablePrice,
            trackingCode,
            accountId,
            marketId
        );

        (, uint feesAccrued, , AsyncOrder.Status status) = order.simulateOrderSettlement(
            marketId,
            PerpsMarket.load(marketId).positions[accountId],
            Price.getCurrentPrice(marketId),
            MarketConfiguration.OrderType.ASYNC_OFFCHAIN
        );

        if (status != AsyncOrder.Status.Success) {
            revert InvalidOrder(status);
        }

        return (order, feesAccrued);
    }

    function settle(uint128 marketId, uint128 accountId) external {
        // 1. get order
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performOrderValidityChecks(marketId, asyncOrderId);

        if (settlementStrategy.strategyType == SettlementStrategy.StrategyType.ONCHAIN) {
            _settleOnChain(order, settlementStrategy);
        } else {
            _settleOffChain(order, settlementStrategy);
        }

        // 3. calculate fees

        // 4. deduct from account
        PerpsAccount.load(accountId).deductFromAccount(strategy.settlementReward);

        // 5. commit to position

        // 6. send keeper reward
    }

    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external payable returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performOrderValidityChecks(marketId, asyncOrderId);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = result;

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates{value: msg.value}(
            updateData,
            priceIds,
            order.settlementTime.to64(),
            (order.settlementTime + settlementStrategy.settlementWindowDuration).to64()
        );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        uint offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            Price.getCurrentPrice(marketId, order.orderType)
        );

        return _settleOrder(offchainPrice, asyncOrder, settlementStrategy);
    }

    function _settleOnchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        uint currentPrice = Price.getCurrentPrice(asyncOrder.marketId);
        settlementStrategy.checkPriceDeviation(currentPrice, asyncOrder.acceptablePrice);

        return _settleOrder(currentPrice, asyncOrder, settlementStrategy);
    }

    function _settleOffchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderModule.settlePythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        // see EIP-3668: https://eips.ethereum.org/EIPS/eip-3668
        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(settlementStrategy.feedId, _getTimeInBytes(order.settlementTime)),
            selector,
            abi.encode(asyncOrder.marketId, asyncOrder.orderId) // extraData that gets sent to callback for validation
        );
    }

    function _settleOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint, int256, uint256) {
        PerpsMarket.load(asyncOrder.marketId).recomputeFunding(price);
        Position.Data storage oldPosition = Position.load(
            asyncOrder.marketId,
            asyncOrder.accountId
        );
        (
            Position.Data memory newPosition,
            uint fees,
            uint settlementReward,
            Status status
        ) = asyncOrder.simulatePosition(oldPosition, price);

        if (status != Status.Success) {
            revert InvalidOrder(status);
        }

        // settlement reward and order fees
        uint totalFees = settlementReward + fees;

        PerpsAccount.load(order.accountId).deductFromAccount(totalFees);

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        // pay keeper
        factory.usdToken.transfer(msg.sender, settlementReward);
        // deposit into market manager
        factory.usdToken.approve(address(this), fees);
        factory.synthetix.depositMarketUsd(order.marketId, address(this), fees);

        Position.load(order.marketId, order.accountId).updatePosition(newPosition);

        // 1. recompute funding
        // 2. current position -> simulate position
        // 3. update position
    }

    function _performOrderValidityChecks(
        uint128 marketId,
        uint128 asyncOrderId
    ) private view returns (AsyncOrder.Data storage, SettlementStrategy.Data storage) {
        AsyncOrder.Data storage order = PerpsMarket.load(marketId).asyncOrders[asyncOrderId];
        SettlementStrategy.Data storage settlementStrategy = SettlementStrategy.load(
            order.settlementStrategyId
        );

        order.checkValidity();
        order.checkWithinSettlementWindow(settlementStrategy);

        return (order, settlementStrategy);
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
