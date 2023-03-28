//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title System wide configuration for anything
 */
library Config {
    struct Data {
        uint256 __unused;
    }

    /**
     * @dev Returns a config value
     */
    function read(bytes32 k, bytes32 zeroValue) internal view returns (bytes32 v) {
        bytes32 s = keccak256(abi.encode("Config", k));
        assembly {
            v := sload(s)
        }

        if (v == bytes32(0)) {
            v = zeroValue;
        }
    }

    function readUint(bytes32 k, uint256 zeroValue) internal view returns (uint256 v) {
        // solhint-disable-next-line numcast/safe-cast
        return uint(read(k, bytes32(zeroValue)));
    }

    function readAddress(bytes32 k, address zeroValue) internal view returns (address v) {
        // solhint-disable-next-line numcast/safe-cast
        return address(uint160(readUint(k, uint160(zeroValue))));
    }

    function put(bytes32 k, bytes32 v) internal {
        bytes32 s = keccak256(abi.encode("Config", k));
        assembly {
            sstore(s, v)
        }
    }
}
