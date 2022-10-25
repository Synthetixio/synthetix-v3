//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _ANOTHER_MODULE = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address private constant _SOME_MODULE = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _SECONDARY_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
    address private constant _UPGRADE_MODULE = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9;

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
                case 0x20965255 {
                    result := _ANOTHER_MODULE
                } // AnotherModule.getValue()
                case 0x25d805cf {
                    result := _SOME_MODULE
                } // SomeModule.getAnotherValue()
                case 0x3659cfe6 {
                    result := _UPGRADE_MODULE
                } // UpgradeModule.upgradeTo()
                case 0xaaf10f42 {
                    result := _UPGRADE_MODULE
                } // UpgradeModule.getImplementation()
                case 0xc7f62cda {
                    result := _UPGRADE_MODULE
                } // UpgradeModule.simulateUpgradeTo()
                case 0xf2c9ecd8 {
                    result := _SECONDARY_MODULE
                } // SecondaryModule.getNumber()
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
