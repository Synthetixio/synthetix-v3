//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../utils/SynthUtil.sol";

/**
 * @title Async order top level data storage
 */
library Policy {
    struct Data {
        uint128 maxAmount;
        uint64 expiresAt;
    }

    function load(uint128 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.insurance-market.Policy", id));
        assembly {
            store.slot := s
        }
    }
}
