//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Order} from "./Order.sol";
import {Position} from "./Position.sol";

library PerpMarket {
    struct Data {
        uint128 marketId;
        bytes32 key;
        int256 skew;
        uint256 size;
        int256 lastComputedFundingRate;
        int256 lastAccumulatedFunding;
        uint256 lastFundingTime;
        // accountId => Order
        mapping(uint128 => Order.Data) orders;
        // accountId => Position
        mapping(uint128 => Position.Data) positions;
    }

    function load(uint128 marketId) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarket", marketId));

        assembly {
            market.slot := s
        }
    }
}
