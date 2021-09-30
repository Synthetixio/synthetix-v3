//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// sample-project
//
// Source code generated from
// Repository: git+https://github.com/Synthetixio/synthetix-v3.git
// Branch: add-deployer-tests
// Commit: 10214076d78a51d47f2762691f96f0733d7e1e31
//
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    address private constant _ANOTHER_MODULE = 0xe8D2A1E88c91DCd5433208d4152Cc4F399a7e91d;
    address private constant _OWNER_MODULE = 0x5067457698Fd6Fa1C6964e416b3f42713513B3dD;
    address private constant _SETTINGS_MODULE = 0x18E317A7D70d8fBf8e6E893616b52390EbBdb629;
    address private constant _SOME_MODULE = 0x4b6aB5F819A515382B0dEB6935D793817bB4af28;
    address private constant _UPGRADE_MODULE = 0xCace1b78160AE76398F486c8a18044da0d66d86D;

    fallback() external payable {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                if lt(sig,0x893d20e8) {
                    switch sig
                    case 0x1098c085 { result := _SETTINGS_MODULE } // SettingsModule.getASettingValue()
                    case 0x20965255 { result := _SOME_MODULE } // SomeModule.getValue()
                    case 0x288b6a36 { result := _OWNER_MODULE } // OwnerModule.getNominatedOwner()
                    case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                    case 0x45aa2181 { result := _ANOTHER_MODULE } // AnotherModule.setSomeValueOnSomeModule()
                    case 0x55241077 { result := _SOME_MODULE } // SomeModule.setValue()
                    case 0x5b94db27 { result := _OWNER_MODULE } // OwnerModule.nominateOwner()
                    case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                    leave
                }
                switch sig
                case 0x893d20e8 { result := _OWNER_MODULE } // OwnerModule.getOwner()
                case 0x9ad4c96f { result := _OWNER_MODULE } // OwnerModule.rejectNomination()
                case 0xa40674b7 { result := _SOME_MODULE } // SomeModule.getSomeValue()
                case 0xa5a7ab1e { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgrades()
                case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                case 0xb0bfc59a { result := _SETTINGS_MODULE } // SettingsModule.setASettingValue()
                case 0xe53831ed { result := _SOME_MODULE } // SomeModule.setSomeValue()
                leave
            }

            implementation := findImplementation(sig32)
        }

        require(implementation != address(0), "Unknown selector");

        // Delegatecall to the implementation contract
        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
