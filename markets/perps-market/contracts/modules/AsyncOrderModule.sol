//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";

contract AsyncOrderModule is IAsyncOrderModule {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using PerpsPrice for PerpsPrice.Data;
    using Position for Position.Data;
    using AsyncOrder for AsyncOrder.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    int256 public constant PRECISION = 18;

    struct RuntimeCommitData {
        uint feesAccrued;
        AsyncOrder.Status status;
    }

    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external override returns (AsyncOrder.Data memory retOrder, uint fees) {
        /*
            1. check valid market
            2. check valid account
            3. check valid settlement strategy
        */

        // order checks
        /*
            1. check if size is 0
            2. check with fees if sufficient margin
            3. check for liquidation with new position size
            4. check that initial margin reqs are met
            5. check order size against max order size
            6. 
        */

        // TODO: recompute funding
        RuntimeCommitData memory runtime;

        AsyncOrder.Data storage order = PerpsMarket.load(commitment.marketId).asyncOrders[
            commitment.accountId
        ];

        SettlementStrategy.Data storage strategy = PerpsMarketConfiguration
            .load(commitment.marketId)
            .settlementStrategies[commitment.settlementStrategyId];

        order.update(commitment, block.timestamp + strategy.settlementDelay);

        (, runtime.feesAccrued, ) = order.validateOrder(
            strategy,
            PerpsPrice.getCurrentPrice(commitment.marketId)
        );

        return (order, runtime.feesAccrued);
    }

    function settle(uint128 marketId, uint128 accountId) external {
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(accountId);
        perpsAccount.checkLiquidationFlag();
        // 1. get order
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performOrderValidityChecks(marketId, accountId);

        if (settlementStrategy.strategyType == SettlementStrategy.Type.ONCHAIN) {
            _settleOnchain(order, settlementStrategy);
        } else {
            _settleOffchain(order, settlementStrategy);
        }
    }

    function settlePythOrder(bytes calldata result, bytes calldata extraData) external payable {
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

        settlementStrategy.checkPriceDeviation(offchainPrice, PerpsPrice.getCurrentPrice(marketId));

        _settleOrder(offchainPrice, order, settlementStrategy);
    }

    function _settleOnchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
        uint currentPrice = PerpsPrice.getCurrentPrice(asyncOrder.marketId);
        settlementStrategy.checkPriceDeviation(currentPrice, asyncOrder.acceptablePrice);

        _settleOrder(currentPrice, asyncOrder, settlementStrategy);
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
            abi.encodePacked(settlementStrategy.feedId, _getTimeInBytes(asyncOrder.settlementTime)),
            selector,
            abi.encode(asyncOrder.marketId, asyncOrder.accountId) // extraData that gets sent to callback for validation
        );
    }

    function _settleOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
        PerpsMarket.load(asyncOrder.marketId).recomputeFunding(price);
        (Position.Data memory newPosition, uint totalFees, ) = asyncOrder.validateOrder(
            settlementStrategy,
            price
        );

        uint settlementReward = settlementStrategy.settlementReward;

        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(asyncOrder.accountId);
        perpsAccount.updatePositionMarkets(asyncOrder.marketId, newPosition.size);
        perpsAccount.deductFromAccount(totalFees);

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        uint amountToDeposit = totalFees - settlementReward;
        if (settlementReward > 0) {
            // pay keeper
            factory.usdToken.transfer(msg.sender, settlementReward);
        }
        if (amountToDeposit > 0) {
            // deposit into market manager
            factory.depositToMarketManager(asyncOrder.marketId, amountToDeposit);
        }

        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(asyncOrder.marketId);
        perpsMarket.updatePositionData(newPosition);

        PerpsMarket.load(asyncOrder.marketId).positions[asyncOrder.accountId].updatePosition(
            newPosition
        );
    }

    function _performOrderValidityChecks(
        uint128 marketId,
        uint128 accountId
    ) private view returns (AsyncOrder.Data storage, SettlementStrategy.Data storage) {
        AsyncOrder.Data storage order = PerpsMarket.load(marketId).asyncOrders[accountId];
        SettlementStrategy.Data storage settlementStrategy = PerpsMarketConfiguration
            .load(marketId)
            .settlementStrategies[order.settlementStrategyId];

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
