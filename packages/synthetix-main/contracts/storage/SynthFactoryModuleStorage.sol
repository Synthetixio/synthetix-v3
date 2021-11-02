//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SynthFactoryModuleStorage {
    struct SynthFactoryNamespace {
        address implementation;
        mapping(bytes32 => address) synthProxies;
    }

    function _synthFactoryStorage() internal pure returns (SynthFactoryNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.synthfactorymodule")) - 1)
            store.slot := 0x28953375d9ae833c3d9741a2da9373bf6506288a418d141ad105018f7b6dba19
        }
    }
}
