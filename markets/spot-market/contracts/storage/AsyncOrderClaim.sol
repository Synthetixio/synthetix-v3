//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./AsyncOrderConfiguration.sol";
import "./SpotMarketFactory.sol";

library AsyncOrderClaim {
    error OrderNotWithinSettlementWindow(
        uint256 timestamp,
        uint256 startTime,
        uint256 expirationTime
    );
    error OrderNotEligibleForCancellation(uint256 timestamp, uint256 expirationTime);

    error InvalidVerificationResponse();

    struct Data {
        SpotMarketFactory.TransactionType orderType;
        uint256 amountEscrowed; // Amount escrowed from trader. (USD denominated on buy. Synth shares denominated on sell.)
        uint256 settlementStrategyId;
        uint256 commitmentTime;
        int256 committedAmountUsd;
        uint256 minimumSettlementAmount;
        uint256 commitmentBlockNum;
    }

    function load(uint128 marketId, uint256 claimId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.spot-market.AsyncOrderClaim", marketId, claimId)
        );
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        uint256 claimId,
        SpotMarketFactory.TransactionType orderType,
        uint256 amountEscrowed,
        uint256 settlementStrategyId,
        uint256 commitmentTime,
        int256 committedAmountUsd,
        uint256 minimumSettlementAmount,
        uint256 commitmentBlockNum
    ) internal returns (Data storage) {
        Data storage self = load(marketId, claimId);
        self.orderType = orderType;
        self.amountEscrowed = amountEscrowed;
        self.settlementStrategyId = settlementStrategyId;
        self.commitmentTime = commitmentTime;
        self.committedAmountUsd = committedAmountUsd;
        self.minimumSettlementAmount = minimumSettlementAmount;
        self.commitmentBlockNum = commitmentBlockNum;

        return self;
    }

    function checkWithinSettlementWindow(
        Data storage claim,
        SettlementStrategy.Data storage settlementStrategy,
        uint256 timestamp
    ) internal view {
        uint startTime = claim.commitmentTime + settlementStrategy.settlementDelay;
        uint expirationTime = startTime + settlementStrategy.settlementWindowDuration;

        if (timestamp < startTime || timestamp >= expirationTime) {
            revert OrderNotWithinSettlementWindow(timestamp, startTime, expirationTime);
        }
    }

    function isEligibleForCancellation(
        Data storage claim,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint expirationTime = claim.commitmentTime +
            settlementStrategy.settlementDelay +
            settlementStrategy.settlementWindowDuration;

        if (block.timestamp < expirationTime) {
            revert OrderNotEligibleForCancellation(block.timestamp, expirationTime);
        }
    }
}
