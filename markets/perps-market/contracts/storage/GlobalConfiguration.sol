//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library GlobalConfiguration {
    struct Data {
        uint256 data;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.GlobalConfiguration"));
        assembly {
            store.slot := s
        }
    }

    function get() internal view {}

    function set() internal {}
}
