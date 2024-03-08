//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "./SettlementStrategy.sol";

/**
 * @title Configuration for async orders
 */
library AsyncOrderConfiguration {
    error InvalidSettlementStrategy(uint256 settlementStrategyId);

    struct Data {
        /**
         * @dev trader can specify one of these configured strategies when placing async order
         */
        SettlementStrategy.Data[] settlementStrategies;
    }

    function load(uint128 marketId) internal pure returns (Data storage asyncOrderConfiguration) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.spot-market.AsyncOrderConfiguration", marketId)
        );
        assembly {
            asyncOrderConfiguration.slot := s
        }
    }

    /**
     * @notice given a strategy id, returns the entire settlement strategy struct
     */
    function validateSettlementStrategy(
        Data storage self,
        uint256 settlementStrategyId
    ) internal view returns (SettlementStrategy.Data storage strategy) {
        validateStrategyExists(self, settlementStrategyId);

        strategy = self.settlementStrategies[settlementStrategyId];
        if (strategy.disabled) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }
    }

    function validateStrategyExists(
        Data storage config,
        uint256 settlementStrategyId
    ) internal view {
        if (settlementStrategyId >= config.settlementStrategies.length) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }
    }
}
