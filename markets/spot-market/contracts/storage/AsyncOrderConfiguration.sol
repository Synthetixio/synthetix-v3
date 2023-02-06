//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./SettlementStrategy.sol";

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
    error InvalidCommitmentAmount(uint amount, uint keepersReward);

    function isValidSettlementStrategy(
        Data storage self,
        uint256 settlementStrategyId
    ) internal view {
        if (settlementStrategyId >= self.settlementStrategies.length) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }

        if (
            self.settlementStrategies[settlementStrategyId].strategyType ==
            SettlementStrategy.Type.ONCHAIN
        ) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }
    }

    function isValidAmount(
        Data storage self,
        uint256 settlementStrategyId,
        uint256 amount
    ) internal view {
        uint keepersReward = self.settlementStrategies[settlementStrategyId].keepersReward;
        if (amount <= keepersReward) {
            revert InvalidCommitmentAmount(amount, keepersReward);
        }
    }
}
