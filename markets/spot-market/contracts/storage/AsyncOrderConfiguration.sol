//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AsyncOrderClaim.sol";

library AsyncOrderConfiguration {
    struct Data {
        mapping(uint256 => AsyncOrderClaim.Data) asyncOrderClaims;
        mapping(address => uint256) escrowedSynthShares;
        uint256 totalEscrowedSynthShares;
        SettlementStrategy[] settlementStrategies;
        int256 asyncUtilizationDelta;
    }

    enum SettlementStrategyType {
        ONCHAIN,
        CHAINLINK,
        PYTH
    }

    struct SettlementStrategy {
        SettlementStrategyType strategyType;
        uint256 fixedFee;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        address priceVerificationContract; // For Chainlink and Pyth settlement strategies
        /*
            - **Price Deviation Circuit Breaker Node ID** - For Chainlink and Pyth settlement strategies. _t.b.d._
            - **Price Deviation Circuit Breaker Tolerance** - For Chainlink and Pyth settlement strategies. _t.b.d._
        */
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrder", marketId));
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) internal {
        update(load(marketId), asyncOrderId, asyncOrderClaim);
    }

    function update(
        Data storage self,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) internal {
        self.asyncOrderClaims[asyncOrderId] = asyncOrderClaim;
    }
}
