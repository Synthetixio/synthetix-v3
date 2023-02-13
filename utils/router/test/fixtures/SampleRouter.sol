//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _SAMPLE_MODULE = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    fallback() external payable {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                switch sig
                case 0x2d22bef9 { result := _SAMPLE_MODULE } // SampleModule.initOrUpgradeNft()
                case 0x60988e09 { result := _SAMPLE_MODULE } // SampleModule.getAssociatedSystem()
                case 0xc6f79537 { result := _SAMPLE_MODULE } // SampleModule.initOrUpgradeToken()
                case 0xd245d983 { result := _SAMPLE_MODULE } // SampleModule.registerUnmanagedSystem()
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
