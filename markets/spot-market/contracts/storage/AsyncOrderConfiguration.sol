//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "./SettlementStrategy.sol";

library AsyncOrderConfiguration {
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

    error InvalidSettlementStrategy(uint256 settlementStrategyId);

    function loadSettlementStrategy(
        Data storage self,
        uint256 settlementStrategyId
    ) internal view returns (SettlementStrategy.Data storage strategy) {
        if (settlementStrategyId >= self.settlementStrategies.length) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }

        strategy = self.settlementStrategies[settlementStrategyId];
        if (strategy.disabled) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }
    }
}
