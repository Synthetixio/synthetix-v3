//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";

/**
 * @title Price storage for a specific synth market.
 */
library PerpsPrice {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        bytes32 settleNodeId; // price used for async orders
        bytes32 indexNodeId; // get index price
    }

    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }

    function getSettlementPrice(uint128 marketId) internal view returns (uint price) {
        bytes32 nodeId = load(marketId).settleNodeId;
        return INodeModule(PerpsMarketFactory.load().oracle).process(nodeId).price.toUint();
    }

    function getCurrentPrice(uint128 marketId) internal view returns (uint price) {
        bytes32 nodeId = load(marketId).indexNodeId;
        return INodeModule(PerpsMarketFactory.load().oracle).process(nodeId).price.toUint();
    }

    function update(Data storage self, bytes32 settleNodeId, bytes32 indexNodeId) internal {
        self.settleNodeId = settleNodeId;
        self.indexNodeId = indexNodeId;
    }
}
