//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";

/**
 * @title Module for committing and settling async orders.
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using PerpsPrice for PerpsPrice.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpsAccount for PerpsAccount.Data;

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external override returns (AsyncOrder.Data memory retOrder, uint fees) {
        PerpsMarket.loadValid(commitment.marketId);

        // Check if commitment.accountId is valid
        Account.exists(commitment.accountId);

        // Check msg.sender can commit order for commitment.accountId
        Account.loadAccountAndValidatePermission(
            commitment.accountId,
            AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION
        );

        GlobalPerpsMarket.load().checkLiquidation(commitment.accountId);

        SettlementStrategy.Data storage strategy = PerpsMarketConfiguration
            .loadValidSettlementStrategy(commitment.marketId, commitment.settlementStrategyId);

        AsyncOrder.Data storage order = AsyncOrder.createValid(commitment, strategy);
        (, uint feesAccrued, , ) = order.validateRequest(
            strategy,
            PerpsPrice.getCurrentPrice(commitment.marketId)
        );

        emit OrderCommitted(
            commitment.marketId,
            commitment.accountId,
            strategy.strategyType,
            commitment.sizeDelta,
            commitment.acceptablePrice,
            order.settlementTime,
            order.settlementTime + strategy.settlementWindowDuration,
            commitment.trackingCode,
            msg.sender
        );

        return (order, feesAccrued);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    // solc-ignore-next-line func-mutability
    function getOrder(
        uint128 accountId
    ) external view override returns (AsyncOrder.Data memory order) {
        order = AsyncOrder.load(accountId);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function computeOrderFees(
        uint128 marketId,
        int128 sizeDelta
    ) external view override returns (uint256 orderFees) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        int256 skew = perpsMarket.skew;
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            marketId
        );
        uint256 fillPrice = AsyncOrder.calculateFillPrice(
            skew,
            marketConfig.skewScale,
            sizeDelta,
            PerpsPrice.getCurrentPrice(marketId)
        );

        orderFees = AsyncOrder.calculateOrderFee(
            sizeDelta,
            fillPrice,
            skew,
            marketConfig.orderFees
        );
    }
}
