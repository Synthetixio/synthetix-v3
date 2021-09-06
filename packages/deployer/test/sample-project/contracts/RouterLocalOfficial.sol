//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// sample-project
//
// Source code generated from
// Repository: git+https://github.com/Synthetixio/synthetix-v3.git
// Branch: add-router-subtasks
// Commit: 9b3866bd9fbe3966f60bba4245cbecb2e4bb1239
//
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract RouterLocalOfficial {
    address private constant _ANOTHERMODULE = 0x36b58F5C1969B7b6591D752ea6F5486D069010AB;
    address private constant _OWNERMODULE = 0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7;
    address private constant _SETTINGSMODULE = 0x0355B7B8cb128fA5692729Ab3AAa199C1753f726;
    address private constant _SOMEMODULE = 0x202CCe504e04bEd6fC0521238dDf04Bc9E8E15aB;
    address private constant _UPGRADEMODULE = 0xf4B146FbA71F41E0592668ffbF264F1D186b2Ca8;

    fallback() external payable {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                if lt(sig,0x893d20e8) {
                    switch sig
                    case 0x1098c085 { result := _SETTINGSMODULE } // SettingsModule.getASettingValue()
                    case 0x20965255 { result := _SOMEMODULE } // SomeModule.getValue()
                    case 0x288b6a36 { result := _OWNERMODULE } // OwnerModule.getNominatedOwner()
                    case 0x3659cfe6 { result := _UPGRADEMODULE } // UpgradeModule.upgradeTo()
                    case 0x55241077 { result := _SOMEMODULE } // SomeModule.setValue()
                    case 0x5b94db27 { result := _OWNERMODULE } // OwnerModule.nominateOwner()
                    case 0x79ba5097 { result := _OWNERMODULE } // OwnerModule.acceptOwnership()
                    case 0x84d3ebad { result := _ANOTHERMODULE } // AnotherModule.setSomeValueRouter()
                    leave
                }
                switch sig
                case 0x893d20e8 { result := _OWNERMODULE } // OwnerModule.getOwner()
                case 0x9ad4c96f { result := _OWNERMODULE } // OwnerModule.rejectNomination()
                case 0xa40674b7 { result := _SOMEMODULE } // SomeModule.getSomeValue()
                case 0xaaf10f42 { result := _UPGRADEMODULE } // UpgradeModule.getImplementation()
                case 0xaedf3e3a { result := _ANOTHERMODULE } // AnotherModule.setSomeValueCast()
                case 0xb0bfc59a { result := _SETTINGSMODULE } // SettingsModule.setASettingValue()
                case 0xe53831ed { result := _SOMEMODULE } // SomeModule.setSomeValue()
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
