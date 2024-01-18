//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";

/**
 * @title Price storage for a specific synth market.
 */
library PerpsPrice {
    using SafeCastI256 for int256;

    enum Tolerance {
        DEFAULT,
        STRICT
    }

    struct Data {
        /**
         * @dev the price feed id for the market.  this node is processed using the oracle manager which returns the price.
         * @dev the staleness tolerance is provided as a runtime argument to this feed for processing.
         */
        bytes32 feedId;
        /**
         * @dev the price feed id for the market quanto asset. This node is processed using the oracle manager which returns the price.
         * @dev the staleness tolerance is provided as a runtime argument to this feed for processing.
         */
        bytes32 quantoFeedId;
        /**
         * @dev strict tolerance in seconds, mainly utilized for liquidations.
         */
        uint256 strictStalenessTolerance;
    }

    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }

    function getCurrentPrice(
        uint128 marketId,
        Tolerance priceTolerance
    ) internal view returns (uint price) {
        return _getCurrentPrice(marketId, priceTolerance, false);
    }

    function getCurrentQuantoPrice(
        uint128 marketId,
        Tolerance priceTolerance
    ) internal view returns (uint price) {
        return _getCurrentPrice(marketId, priceTolerance, true);
    }

    function _getCurrentPrice(
        uint128 marketId,
        Tolerance priceTolerance,
        bool isQuanto
    ) internal view returns (uint price) {
        Data storage self = load(marketId);
        bytes32 feedId = isQuanto ? self.quantoFeedId : self.feedId;
        // TODO: check - are we certain this always works?
        /// @dev if the quantoFeedId is not set, the base asset is USD, which has a price of 1 USD per USD
        if (isQuanto && feedId == bytes32(0)) {
            return 1 ether;
        }

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
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

        return output.price.toUint();
    }

    function update(Data storage self, bytes32 feedId, uint256 strictStalenessTolerance) internal {
        self.feedId = feedId;
        self.strictStalenessTolerance = strictStalenessTolerance;
    }

    function updateQuantoFeedId(Data storage self, bytes32 quantoFeedId) internal {
        self.quantoFeedId = quantoFeedId;
    }
}
