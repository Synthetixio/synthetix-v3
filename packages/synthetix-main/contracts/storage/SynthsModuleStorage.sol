//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SynthsModuleStorage {
    struct SynthsModuleStore {
        address beacon;
        mapping(bytes32 => address) synthProxies;
    }

    function _synthsModuleStore() internal pure returns (SynthsModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.synthfactorymodule")) - 1)
            store.slot := 0x08fe9d304cecb3855e66d23c986057fcb83973589fa6989cb5b520bf250acf97
        }
    }
}
