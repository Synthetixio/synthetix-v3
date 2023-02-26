//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./OrderFee.sol";
import "./SettlementStrategy.sol";

library MarketConfiguration {
    enum OrderType {
        ASYNC_ONCHAIN,
        ASYNC_OFFCHAIN,
        ATOMIC
    }

    struct Data {
        mapping(OrderType => OrderFee.Data) orderFees;
        SettlementStrategy.Data[] settlementStrategies;
        uint16 maxLeverage;
        uint256 maxMarketValue; // oi cap
        uint256 maxFundingVelocity;
        uint256 skewScale;
        uint256 minInitialMargin;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.MarketConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }
}
