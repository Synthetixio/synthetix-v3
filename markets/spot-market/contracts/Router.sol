//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _SPOT_MARKET_MODULE = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address private constant _SYNTH = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _OWNER_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
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
                if lt(sig,0x718fe928) {
                    if lt(sig,0x3659cfe6) {
                        if lt(sig,0x23b872dd) {
                            switch sig
                            case 0x06fdde03 { result := _SYNTH } // Synth.name()
                            case 0x095ea7b3 { result := _SYNTH } // Synth.approve()
                            case 0x1624f6c6 { result := _SYNTH } // Synth.initialize()
                            case 0x1627540c { result := _OWNER_MODULE } // OwnerModule.nominateNewOwner()
                            case 0x18160ddd { result := _SYNTH } // Synth.totalSupply()
                            leave
                        }
                        switch sig
                        case 0x23b872dd { result := _SYNTH } // Synth.transferFrom()
                        case 0x2433aa0c { result := _SPOT_MARKET_MODULE } // SpotMarketModule.registerSynth()
                        case 0x2d22bef9 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.initOrUpgradeNft()
                        case 0x313ce567 { result := _SYNTH } // Synth.decimals()
                        case 0x35eb2824 { result := _OWNER_MODULE } // OwnerModule.isOwnerModuleInitialized()
                        leave
                    }
                    switch sig
                    case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                    case 0x392e53cd { result := _SYNTH } // Synth.isInitialized()
                    case 0x3b85eb70 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.getSynthPrice()
                    case 0x40c10f19 { result := _SYNTH } // Synth.mint()
                    case 0x53a47bb7 { result := _OWNER_MODULE } // OwnerModule.nominatedOwner()
                    case 0x60988e09 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.getAssociatedSystem()
                    case 0x624bd96d { result := _OWNER_MODULE } // OwnerModule.initializeOwnerModule()
                    case 0x6d4d9e9b { result := _SPOT_MARKET_MODULE } // SpotMarketModule.setExternalSystems()
                    case 0x70a08231 { result := _SYNTH } // Synth.balanceOf()
                    leave
                }
                if lt(sig,0xc7f62cda) {
                    switch sig
                    case 0x718fe928 { result := _OWNER_MODULE } // OwnerModule.renounceNomination()
                    case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                    case 0x83e5ba9d { result := _SPOT_MARKET_MODULE } // SpotMarketModule.reportedDebt()
                    case 0x8da5cb5b { result := _OWNER_MODULE } // OwnerModule.owner()
                    case 0x95d89b41 { result := _SYNTH } // Synth.symbol()
                    case 0x9dc29fac { result := _SYNTH } // Synth.burn()
                    case 0xa9059cbb { result := _SYNTH } // Synth.transfer()
                    case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                    case 0xc6f79537 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.initOrUpgradeToken()
                    leave
                }
                switch sig
                case 0xc7f62cda { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgradeTo()
                case 0xd034eef6 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.updateFeeManager()
                case 0xd245d983 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.registerUnmanagedSystem()
                case 0xd42abed3 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.exchange()
                case 0xd6febde8 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.buy()
                case 0xd79875eb { result := _SPOT_MARKET_MODULE } // SpotMarketModule.sell()
                case 0xda46098c { result := _SYNTH } // Synth.setAllowance()
                case 0xdd62ed3e { result := _SYNTH } // Synth.allowance()
                case 0xeb44fdd3 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.getMarket()
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
