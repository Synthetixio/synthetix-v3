//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {Position} from "./Position.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {OrderFee} from "./OrderFee.sol";

import { SkewTriggerTraunche } from "./SkewTriggerTraunche.sol";

/**
 * @title Skew trigger order storage
 * This order is effectively a long-running order good until zerod-out. It works by opening a 
 * Even if the order isnt actively operating a position, a user can still be liquidated, so it is important that an account owner
 * always maintains sufficient margin.
 * 
 * The purpose of this order type is to increase, thereby giving a better fill price for regular async orders.
 */
library SkewTriggerOrder {
    using DecimalMath for int256;
    using DecimalMath for int128;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using PerpsMarket for PerpsMarket.Data;
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;
    using SkewTriggerTraunche for SkewTriggerTraunche.Data;

    /**
     * @notice Thrown when there's not enough margin to cover the order and settlement costs associated.
     */
    error InsufficientMargin(int availableMargin, uint minMargin);

    struct Data {
        /**
         * @dev Order account id.
         */
        uint128 accountId;
        /**
         * @dev Order market id.
         */
        uint128 marketId;
        /**
         * @dev Order size (total size when fully open at end of traunche)
         */
        int128 size;

        /**
         * @dev The traunche to start at. To learn more about traunches read up in SkewTriggerTraunche -maxTraunche < startTraunche < maxTraunche. startTraunche > endTraunche. startTraunche / endTraunche > 0
         */
        int64 startTraunche;

        /**
         * The end traunche.
         */
        int64 endTraunche;

        /**
         * @dev An optional code provided by frontends to assist with tracking the source of volume and fees.
         */
        bytes32 trackingCode;
    }

    /**
     * @notice Updates the order with the commitment request data and settlement time.
     */
    function load(uint128 accountId, bool long) internal pure returns (Data storage order) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.SkewTriggerOrder", accountId, bool long));

        assembly {
            order.slot := s
        }
    }

    /**
     * @dev Reverts if the order does not belongs to the market or not exists. Otherwise, returns the order.
     * @dev non-existent order is considered an order with sizeDelta == 0.
     */
    function loadValid(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (Data storage order) {
        order = load(accountId);
        if (order.marketId != marketId || order.sizeDelta == 0) {
            revert OrderNotValid();
        }
    }

    /**
     */
    function put(
        Data memory newData
    ) internal view returns (Data storage order) {
        self = load(accountId, newData.endTraunche >= 0);

        uint256 numTraunches = MathUtil.abs(newData.endTraunche - newData.startTraunche);

        // size gets spread equally even though traunches are geometrically sized
        uint256 sizePerTraunche = newData.size / numTraunches;

        // adjust the user's requested size to prevent roundoff error
        newData.size = self.size + sizePerTraunche * numTraunches;

        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);

        for (uint256 i = newData.startTraunche;i < newData.endTraunche;i++) {
            SkewTriggerTraunche.Data storage traunche = SkewTriggerTraunche.load(newData.marketId, idx);
            traunche.applyAccountContribution(accountId, sizePerTraunche);
            uint256 traunchePortion = calculateTraunchePortion(i, skew);

            // the position of the traunche only changes if portion is greater than 0
            if (traunchePortion > 0) {
                traunche.applyPosition(marketId, traunchePortion);
            }
        }

        self = newData;
    }

    function calculateTraunchePortion(int256 i, int256 skew) internal pure returns (uint256 portion) {
        (int256 trauncheStart, uint256 trauncheLen) = SkewTriggerTraunche.getTrauncheProperties(i);

        if (MathUtil.abs(skew) <= MathUtil.abs(trauncheStart)) {
            return 0;
        }

        if (MathUtil.abs(skew) >= MathUtil.abs(trauncheStart) + trauncheLen) {
            return 1e18;
        }

        // TODO: might be an exponsential effect instead? depends on math outside
        return Math.abs(skew - trauncheStart).divDecimal(trauncheLen);
    }
}
