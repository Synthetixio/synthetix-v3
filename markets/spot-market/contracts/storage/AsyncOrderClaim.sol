//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./AsyncOrderConfiguration.sol";
import "./SpotMarketFactory.sol";

library AsyncOrderClaim {
    error OutsideSettlementWindow(uint256 timestamp, uint256 startTime, uint256 expirationTime);
    error IneligibleForCancellation(uint256 timestamp, uint256 expirationTime);
    error OrderAlreadySettled(uint256 asyncOrderId);

    struct Data {
        SpotMarketFactory.TransactionType orderType;
        uint256 amountEscrowed; // Amount escrowed from trader. (USD denominated on buy. Synth shares denominated on sell.)
        uint256 settlementStrategyId;
        uint256 settlementTime;
        int256 committedAmountUsd;
        uint256 minimumSettlementAmount;
        uint256 commitmentBlockNum;
        uint256 settledAt;
        address settlementAddress;
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
        uint256 settlementTime,
        int256 committedAmountUsd,
        uint256 minimumSettlementAmount,
        address settlementAddress
    ) internal returns (Data storage) {
        Data storage self = load(marketId, claimId);
        self.orderType = orderType;
        self.amountEscrowed = amountEscrowed;
        self.settlementStrategyId = settlementStrategyId;
        self.settlementTime = settlementTime;
        self.committedAmountUsd = committedAmountUsd;
        self.minimumSettlementAmount = minimumSettlementAmount;
        self.settlementAddress = settlementAddress;
        return self;
    }

    function checkSettlementValidity(
        Data storage claim,
        uint asyncOrderId,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        if (claim.settledAt != 0) {
            revert OrderAlreadySettled(asyncOrderId);
        }

        uint startTime = claim.settlementTime;
        uint expirationTime = startTime + settlementStrategy.settlementWindowDuration;

        if (block.timestamp < startTime || block.timestamp >= expirationTime) {
            revert OutsideSettlementWindow(block.timestamp, startTime, expirationTime);
        }
    }

    function isEligibleForCancellation(
        Data storage claim,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint expirationTime = claim.settlementTime + settlementStrategy.settlementWindowDuration;

        if (block.timestamp < expirationTime) {
            revert IneligibleForCancellation(block.timestamp, expirationTime);
        }
    }
}
