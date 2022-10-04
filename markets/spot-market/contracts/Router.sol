//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _OWNER_MODULE = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address private constant _SPOT_MARKET_MODULE = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _UPGRADE_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;

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
                        case 0x06fdde03 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.name()
                        case 0x095ea7b3 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.approve()
                        case 0x0cf39ef8 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.initialize()
                        case 0x1627540c { result := _OWNER_MODULE } // OwnerModule.nominateNewOwner()
                        case 0x18160ddd { result := _SPOT_MARKET_MODULE } // SpotMarketModule.totalSupply()
                        case 0x23b872dd { result := _SPOT_MARKET_MODULE } // SpotMarketModule.transferFrom()
                        case 0x313ce567 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.decimals()
                        leave
                    }
                    switch sig
                    case 0x35eb2824 { result := _OWNER_MODULE } // OwnerModule.isOwnerModuleInitialized()
                    case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                    case 0x392e53cd { result := _SPOT_MARKET_MODULE } // SpotMarketModule.isInitialized()
                    case 0x53a47bb7 { result := _OWNER_MODULE } // OwnerModule.nominatedOwner()
                    case 0x624bd96d { result := _OWNER_MODULE } // OwnerModule.initializeOwnerModule()
                    case 0x70a08231 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.balanceOf()
                    leave
                }
                if lt(sig,0xaaf10f42) {
                    switch sig
                    case 0x718fe928 { result := _OWNER_MODULE } // OwnerModule.renounceNomination()
                    case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                    case 0x83e5ba9d { result := _SPOT_MARKET_MODULE } // SpotMarketModule.reportedDebt()
                    case 0x8da5cb5b { result := _OWNER_MODULE } // OwnerModule.owner()
                    case 0x95d89b41 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.symbol()
                    case 0xa9059cbb { result := _SPOT_MARKET_MODULE } // SpotMarketModule.transfer()
                    leave
                }
                switch sig
                case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                case 0xc6acd274 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.updateFeeManager()
                case 0xc7f62cda { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgradeTo()
                case 0xd96a094a { result := _SPOT_MARKET_MODULE } // SpotMarketModule.buy()
                case 0xdd62ed3e { result := _SPOT_MARKET_MODULE } // SpotMarketModule.allowance()
                case 0xe4849b32 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.sell()
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
