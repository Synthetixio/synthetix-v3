//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// sample-project
//
// Source code generated from
// Repository: git+https://github.com/Synthetixio/synthetix-v3.git
// Branch: add-deployer-tests
// Commit: 40f167918d552266c9238e8789a6663e3617aa29
//
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _NEW_MODULE = 0x610178dA211FEF7D417bC0e6FeD39F05609AD788;
    address private constant _SAMPLE_OWNER_MODULE = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _SAMPLE_UPGRADE_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
    address private constant _SETTINGS_MODULE = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9;
    address private constant _SOME_MODULE = 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318;

    fallback() external payable {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                if lt(sig, 0x718fe928) {
                    switch sig
                    case 0x1098c085 {
                        result := _SETTINGS_MODULE
                    } // SettingsModule.getASettingValue()
                    case 0x1627540c {
                        result := _SAMPLE_OWNER_MODULE
                    } // SampleOwnerModule.nominateNewOwner()
                    case 0x1e57f77e {
                        result := _NEW_MODULE
                    } // NewModule.setSomeNewValue()
                    case 0x20965255 {
                        result := _SOME_MODULE
                    } // SomeModule.getValue()
                    case 0x2cfe5d9c {
                        result := _SOME_MODULE
                    } // SomeModule.fourtyTwo()
                    case 0x3659cfe6 {
                        result := _SAMPLE_UPGRADE_MODULE
                    } // SampleUpgradeModule.safeUpgradeTo()
                    case 0x53a47bb7 {
                        result := _SAMPLE_OWNER_MODULE
                    } // SampleOwnerModule.nominatedOwner()
                    case 0x55241077 {
                        result := _SOME_MODULE
                    } // SomeModule.setValue()
                    leave
                }
                switch sig
                case 0x718fe928 {
                    result := _SAMPLE_OWNER_MODULE
                } // SampleOwnerModule.renounceNomination()
                case 0x79ba5097 {
                    result := _SAMPLE_OWNER_MODULE
                } // SampleOwnerModule.acceptOwnership()
                case 0x8da5cb5b {
                    result := _SAMPLE_OWNER_MODULE
                } // SampleOwnerModule.owner()
                case 0xa40674b7 {
                    result := _SOME_MODULE
                } // SomeModule.getSomeValue()
                case 0xa5a7ab1e {
                    result := _SAMPLE_UPGRADE_MODULE
                } // SampleUpgradeModule.simulateUpgrades()
                case 0xaaf10f42 {
                    result := _SAMPLE_UPGRADE_MODULE
                } // SampleUpgradeModule.getImplementation()
                case 0xb0bfc59a {
                    result := _SETTINGS_MODULE
                } // SettingsModule.setASettingValue()
                case 0xe53831ed {
                    result := _SOME_MODULE
                } // SomeModule.setSomeValue()
                leave
            }

            implementation := findImplementation(sig32)
        }

        if (implementation == address(0)) {
            revert UnknownSelector(sig4);
        }

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
