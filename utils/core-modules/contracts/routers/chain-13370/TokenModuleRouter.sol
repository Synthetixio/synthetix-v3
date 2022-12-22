//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract TokenModuleRouter {
    error UnknownSelector(bytes4 sel);

    address private constant _CORE_MODULE = 0xE5E1f61d38e32a5BD663038bf669fACC66adF715;
    address private constant _TOKEN_MODULE = 0x470fC56e8bDde2718d8525118c8a86636E82a4D9;

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
                if lt(sig,0x624bd96d) {
                    if lt(sig,0x313ce567) {
                        switch sig
                        case 0x06fdde03 { result := _TOKEN_MODULE } // TokenModule.name()
                        case 0x095ea7b3 { result := _TOKEN_MODULE } // TokenModule.approve()
                        case 0x1624f6c6 { result := _TOKEN_MODULE } // TokenModule.initialize()
                        case 0x1627540c { result := _CORE_MODULE } // CoreModule.nominateNewOwner()
                        case 0x18160ddd { result := _TOKEN_MODULE } // TokenModule.totalSupply()
                        case 0x23b872dd { result := _TOKEN_MODULE } // TokenModule.transferFrom()
                        leave
                    }
                    switch sig
                    case 0x313ce567 { result := _TOKEN_MODULE } // TokenModule.decimals()
                    case 0x35eb2824 { result := _CORE_MODULE } // CoreModule.isOwnerModuleInitialized()
                    case 0x3659cfe6 { result := _CORE_MODULE } // CoreModule.upgradeTo()
                    case 0x392e53cd { result := _TOKEN_MODULE } // TokenModule.isInitialized()
                    case 0x40c10f19 { result := _TOKEN_MODULE } // TokenModule.mint()
                    case 0x53a47bb7 { result := _CORE_MODULE } // CoreModule.nominatedOwner()
                    leave
                }
                if lt(sig,0x9dc29fac) {
                    switch sig
                    case 0x624bd96d { result := _CORE_MODULE } // CoreModule.initializeOwnerModule()
                    case 0x70a08231 { result := _TOKEN_MODULE } // TokenModule.balanceOf()
                    case 0x718fe928 { result := _CORE_MODULE } // CoreModule.renounceNomination()
                    case 0x79ba5097 { result := _CORE_MODULE } // CoreModule.acceptOwnership()
                    case 0x8da5cb5b { result := _CORE_MODULE } // CoreModule.owner()
                    case 0x95d89b41 { result := _TOKEN_MODULE } // TokenModule.symbol()
                    leave
                }
                switch sig
                case 0x9dc29fac { result := _TOKEN_MODULE } // TokenModule.burn()
                case 0xa9059cbb { result := _TOKEN_MODULE } // TokenModule.transfer()
                case 0xaaf10f42 { result := _CORE_MODULE } // CoreModule.getImplementation()
                case 0xc7f62cda { result := _CORE_MODULE } // CoreModule.simulateUpgradeTo()
                case 0xda46098c { result := _TOKEN_MODULE } // TokenModule.setAllowance()
                case 0xdd62ed3e { result := _TOKEN_MODULE } // TokenModule.allowance()
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
