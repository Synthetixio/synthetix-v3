//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SpotMarketFactory} from "./SpotMarketFactory.sol";
import {Transaction} from "../utils/TransactionUtil.sol";

/**
 * @title Price storage for a specific synth market.
 */
library Price {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;

    enum Tolerance {
        DEFAULT,
        STRICT
    }

    struct Data {
        /**
         * @dev The oracle manager node id used for buy transactions.
         */
        bytes32 buyFeedId;
        /**
         * @dev The oracle manager node id used for all non-buy transactions.
         * @dev also used to for calculating reported debt
         */
        bytes32 sellFeedId;
        /**
         * @dev configurable staleness tolerance to use when fetching prices.
         */
        uint256 strictStalenessTolerance;
    }

    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }

    function getCurrentPrice(
        uint128 marketId,
        Transaction.Type transactionType,
        Tolerance priceTolerance
    ) internal view returns (uint256 price) {
        Data storage self = load(marketId);
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        bytes32 feedId = Transaction.isBuy(transactionType) ? self.buyFeedId : self.sellFeedId;

        NodeOutput.Data memory output;

        if (priceTolerance == Tolerance.STRICT) {
            bytes32[] memory runtimeKeys = new bytes32[](1);
            bytes32[] memory runtimeValues = new bytes32[](1);
            runtimeKeys[0] = bytes32("stalenessTolerance");
            runtimeValues[0] = bytes32(self.strictStalenessTolerance);
            output = INodeModule(factory.oracle).processWithRuntime(
                feedId,
                runtimeKeys,
                runtimeValues
            );
        } else {
            output = INodeModule(factory.oracle).process(feedId);
        }

        price = output.price.toUint();
    }

    /**
     * @dev Updates price feeds.  Function resides in SpotMarketFactory to update these values.
     * Only market owner can update these values.
     */
    function update(
        Data storage self,
        bytes32 buyFeedId,
        bytes32 sellFeedId,
        uint256 strictStalenessTolerance
    ) internal {
        self.buyFeedId = buyFeedId;
        self.sellFeedId = sellFeedId;
        self.strictStalenessTolerance = strictStalenessTolerance;
    }

    /**
     * @dev Utility function that returns the amount denominated with 18 decimals of precision.
     */
    function scale(int256 amount, uint256 decimals) internal pure returns (int256 scaledAmount) {
        return (decimals > 18 ? amount.downscale(decimals - 18) : amount.upscale(18 - decimals));
    }

    /**
     * @dev Utility function that receive amount with 18 decimals
     * returns the amount denominated with number of decimals as arg of 18.
     */
    function scaleTo(int256 amount, uint256 decimals) internal pure returns (int256 scaledAmount) {
        return (decimals > 18 ? amount.upscale(decimals - 18) : amount.downscale(18 - decimals));
    }
}
