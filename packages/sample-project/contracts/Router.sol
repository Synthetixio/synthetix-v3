//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _INITIALIZABLE_MODULE = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _NEW_MODULE = 0x610178dA211FEF7D417bC0e6FeD39F05609AD788;
    address private constant _OWNER_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
    address private constant _SOME_MODULE = 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318;
    address private constant _TOKEN_MODULE = 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707;
    address private constant _UPGRADE_MODULE = 0x0165878A594ca255338adfa4d48449f69242Eb8F;

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
                if lt(sig,0x718fe928) {
                    if lt(sig,0x35eb2824) {
                        switch sig
                        case 0x02cc6e89 { result := _TOKEN_MODULE } // TokenModule.createSampleToken()
                        case 0x1627540c { result := _OWNER_MODULE } // OwnerModule.nominateNewOwner()
                        case 0x1e57f77e { result := _NEW_MODULE } // NewModule.setSomeNewValue()
                        case 0x20965255 { result := _SOME_MODULE } // SomeModule.getValue()
                        case 0x2cfe5d9c { result := _SOME_MODULE } // SomeModule.fourtyTwo()
                        leave
                    }
                    switch sig
                    case 0x35eb2824 { result := _OWNER_MODULE } // OwnerModule.isOwnerModuleInitialized()
                    case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                    case 0x53a47bb7 { result := _OWNER_MODULE } // OwnerModule.nominatedOwner()
                    case 0x55241077 { result := _SOME_MODULE } // SomeModule.setValue()
                    case 0x624bd96d { result := _OWNER_MODULE } // OwnerModule.initializeOwnerModule()
                    leave
                }
                if lt(sig,0xaaf10f42) {
                    switch sig
                    case 0x718fe928 { result := _OWNER_MODULE } // OwnerModule.renounceNomination()
                    case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                    case 0x8da5cb5b { result := _OWNER_MODULE } // OwnerModule.owner()
                    case 0xa40674b7 { result := _SOME_MODULE } // SomeModule.getSomeValue()
                    case 0xa91d1b07 { result := _INITIALIZABLE_MODULE } // InitializableModule.initializeInitializableModule()
                    leave
                }
                switch sig
                case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                case 0xb877ab34 { result := _TOKEN_MODULE } // TokenModule.getTokenModuleSatellites()
                case 0xc7f62cda { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgradeTo()
                case 0xe53831ed { result := _SOME_MODULE } // SomeModule.setSomeValue()
                case 0xfd393dd9 { result := _INITIALIZABLE_MODULE } // InitializableModule.isInitializableModuleInitialized()
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
