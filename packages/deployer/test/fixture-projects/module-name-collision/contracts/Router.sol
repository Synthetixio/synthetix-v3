//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _CONTRACTS_MODULES__SOME_MODULE_SOL__SOME_MODULE = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address private constant _CONTRACTS_MODULES__UPGRADE_MODULE_SOL__UPGRADE_MODULE = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _CONTRACTS_MODULES_DUPLICATE__SOME_MODULE_SOL__SOME_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;

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
                switch sig
                case 0x20965255 { result := _CONTRACTS_MODULES__SOME_MODULE_SOL__SOME_MODULE } // contracts/modules/SomeModule.sol:SomeModule.getValue()
                case 0x3659cfe6 { result := _CONTRACTS_MODULES__UPGRADE_MODULE_SOL__UPGRADE_MODULE } // contracts/modules/UpgradeModule.sol:UpgradeModule.upgradeTo()
                case 0xaaf10f42 { result := _CONTRACTS_MODULES__UPGRADE_MODULE_SOL__UPGRADE_MODULE } // contracts/modules/UpgradeModule.sol:UpgradeModule.getImplementation()
                case 0xc7f62cda { result := _CONTRACTS_MODULES__UPGRADE_MODULE_SOL__UPGRADE_MODULE } // contracts/modules/UpgradeModule.sol:UpgradeModule.simulateUpgradeTo()
                case 0xfead5eda { result := _CONTRACTS_MODULES_DUPLICATE__SOME_MODULE_SOL__SOME_MODULE } // contracts/modules/duplicate/SomeModule.sol:SomeModule.getYetAnotherValue()
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
