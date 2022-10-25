//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _FEATURE_FLAG_MODULE = 0xd4a2731FAf817F823220CC4e10d0C34B5eB54445;
    address private constant _OWNER_MODULE = 0x1772d41507B0a17077F531968D0a254eda3455B1;
    address private constant _UPGRADE_MODULE = 0x942383c92B34A1195f1085290cdAddbaf3Ab8D0F;
    address private constant _USDTOKEN_MODULE = 0xcAf610764C1CDf7D34D4479Bd67440D5D973C90f;

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
                if lt(sig,0x70a08231) {
                    if lt(sig,0x35eb2824) {
                        switch sig
                        case 0x06fdde03 { result := _USDTOKEN_MODULE } // USDTokenModule.name()
                        case 0x095ea7b3 { result := _USDTOKEN_MODULE } // USDTokenModule.approve()
                        case 0x1624f6c6 { result := _USDTOKEN_MODULE } // USDTokenModule.initialize()
                        case 0x1627540c { result := _OWNER_MODULE } // OwnerModule.nominateNewOwner()
                        case 0x18160ddd { result := _USDTOKEN_MODULE } // USDTokenModule.totalSupply()
                        case 0x23b872dd { result := _USDTOKEN_MODULE } // USDTokenModule.transferFrom()
                        case 0x313ce567 { result := _USDTOKEN_MODULE } // USDTokenModule.decimals()
                        leave
                    }
                    switch sig
                    case 0x35eb2824 { result := _OWNER_MODULE } // OwnerModule.isOwnerModuleInitialized()
                    case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                    case 0x392e53cd { result := _USDTOKEN_MODULE } // USDTokenModule.isInitialized()
                    case 0x40c10f19 { result := _USDTOKEN_MODULE } // USDTokenModule.mint()
                    case 0x53a47bb7 { result := _OWNER_MODULE } // OwnerModule.nominatedOwner()
                    case 0x60b645f8 { result := _FEATURE_FLAG_MODULE } // FeatureFlagModule.addToFeatureFlag()
                    case 0x624bd96d { result := _OWNER_MODULE } // OwnerModule.initializeOwnerModule()
                    leave
                }
                if lt(sig,0x9dc29fac) {
                    switch sig
                    case 0x70a08231 { result := _USDTOKEN_MODULE } // USDTokenModule.balanceOf()
                    case 0x718fe928 { result := _OWNER_MODULE } // OwnerModule.renounceNomination()
                    case 0x7547ba7e { result := _FEATURE_FLAG_MODULE } // FeatureFlagModule.setFeatureFlag()
                    case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                    case 0x7b0af27a { result := _FEATURE_FLAG_MODULE } // FeatureFlagModule.removeFromFeatureFlag()
                    case 0x8da5cb5b { result := _OWNER_MODULE } // OwnerModule.owner()
                    case 0x95d89b41 { result := _USDTOKEN_MODULE } // USDTokenModule.symbol()
                    leave
                }
                switch sig
                case 0x9dc29fac { result := _USDTOKEN_MODULE } // USDTokenModule.burn()
                case 0xa9059cbb { result := _USDTOKEN_MODULE } // USDTokenModule.transfer()
                case 0xaaa15fd1 { result := _USDTOKEN_MODULE } // USDTokenModule.burnWithAllowance()
                case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                case 0xc7f62cda { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgradeTo()
                case 0xda46098c { result := _USDTOKEN_MODULE } // USDTokenModule.setAllowance()
                case 0xdd62ed3e { result := _USDTOKEN_MODULE } // USDTokenModule.allowance()
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
