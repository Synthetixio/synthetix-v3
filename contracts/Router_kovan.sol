//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// synthetix-v3
//
// Source code generated from
// Repository: git+https://github.com/Synthetixio/synthetix-v3.git
// Branch: basic-deployer
// Commit: 8319f8a1524232a945d6eaefffaaa1215dcdefe
//
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router_kovan {
    address private constant _OWNERMODULE = 0xdcB9244F6B3f12C69fB8C025ddBb17b1A31155ab;
    address private constant _UPGRADEMODULE = 0x14D549e0421C14e25AE7F776360b10f1f6b885De;

    fallback() external payable {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                switch sig
                    case 0x288b6a36 {
                        result := _OWNERMODULE
                    } // OwnerModule.getNominatedOwner()
                    case 0x3659cfe6 {
                        result := _UPGRADEMODULE
                    } // UpgradeModule.upgradeTo()
                    case 0x5b94db27 {
                        result := _OWNERMODULE
                    } // OwnerModule.nominateOwner()
                    case 0x79ba5097 {
                        result := _OWNERMODULE
                    } // OwnerModule.acceptOwnership()
                    case 0x893d20e8 {
                        result := _OWNERMODULE
                    } // OwnerModule.getOwner()
                    case 0x944ba554 {
                        result := _UPGRADEMODULE
                    } // UpgradeModule.canUpgradeAgain()
                    case 0x9ad4c96f {
                        result := _OWNERMODULE
                    } // OwnerModule.rejectNomination()
                    case 0xaaf10f42 {
                        result := _UPGRADEMODULE
                    } // UpgradeModule.getImplementation()
                    case 0xdaa3a163 {
                        result := _UPGRADEMODULE
                    } // UpgradeModule.isUpgradeable()
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
