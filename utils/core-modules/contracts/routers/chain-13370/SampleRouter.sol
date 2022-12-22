//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract SampleRouter {
    error UnknownSelector(bytes4 sel);

    address private constant _CORE_MODULE = 0xE5E1f61d38e32a5BD663038bf669fACC66adF715;
    address private constant _SAMPLE_OWNED_MODULE = 0x544e2284B08A3ecc0Cc377A4BB747a9FA9F03CBe;
    address private constant _SAMPLE_MODULE_A = 0xA54E713A7FF6422F2320c081d058928462739fFB;
    address private constant _SAMPLE_MODULE_B = 0x43fC92D732B88f32185E97B0B459eA9a31E3Ec6E;

    fallback() external payable {
        _forward();
    }

    receive() external payable {
        _forward();
    }

    function _forward() internal {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                if lt(sig,0x8da5cb5b) {
                    switch sig
                    case 0x1627540c { result := _CORE_MODULE } // CoreModule.nominateNewOwner()
                    case 0x285f569d { result := _SAMPLE_OWNED_MODULE } // SampleOwnedModule.setProtectedValue()
                    case 0x35eb2824 { result := _CORE_MODULE } // CoreModule.isOwnerModuleInitialized()
                    case 0x3659cfe6 { result := _CORE_MODULE } // CoreModule.upgradeTo()
                    case 0x53a47bb7 { result := _CORE_MODULE } // CoreModule.nominatedOwner()
                    case 0x624bd96d { result := _CORE_MODULE } // CoreModule.initializeOwnerModule()
                    case 0x718fe928 { result := _CORE_MODULE } // CoreModule.renounceNomination()
                    case 0x79ba5097 { result := _CORE_MODULE } // CoreModule.acceptOwnership()
                    leave
                }
                switch sig
                case 0x8da5cb5b { result := _CORE_MODULE } // CoreModule.owner()
                case 0x8f51f8e2 { result := _SAMPLE_MODULE_B } // SampleModuleB.setSomeValueOnSampleModuleA()
                case 0xa40674b7 { result := _SAMPLE_MODULE_A } // SampleModuleA.getSomeValue()
                case 0xaaf10f42 { result := _CORE_MODULE } // CoreModule.getImplementation()
                case 0xc7f62cda { result := _CORE_MODULE } // CoreModule.simulateUpgradeTo()
                case 0xd10b0a79 { result := _SAMPLE_OWNED_MODULE } // SampleOwnedModule.getProtectedValue()
                case 0xe53831ed { result := _SAMPLE_MODULE_A } // SampleModuleA.setSomeValue()
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
