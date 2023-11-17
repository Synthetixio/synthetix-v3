//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {PythStructs, IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";

/**
 * @title Benchmark price storage for a specific price id.
 */
library Price {
    struct Data {
        /**
         * @dev The price mapping for timestamps
         */
        mapping(uint64 => PythStructs.Price) benchmarkPrices;
    }

    function load(bytes32 priceId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.pyth-erc7412-wrapper.price", priceId));
        assembly {
            price.slot := s
        }
    }
}
