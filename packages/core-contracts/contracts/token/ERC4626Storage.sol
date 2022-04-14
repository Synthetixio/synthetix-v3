//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC4626Storage {
    struct ERC4626Store {
        address assetAddress;
    }

    function _erc4626Store() internal pure returns (ERC4626Store storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.ERC4626")) - 1)
            store.slot := 0xda0ce98a951a7a931189f5e622ebcc5a4f5481440238f45f57c834a6be9f250b
        }
    }
}
