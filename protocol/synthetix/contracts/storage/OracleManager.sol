//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Represents Oracle Manager
 */
library OracleManager {
    struct Data {
        /**
         * @dev The oracle manager address.
         */
        address oracleManagerAddress;
    }

    function load() internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("OracleManager"));
        assembly {
            data.slot := s
        }
    }
}
