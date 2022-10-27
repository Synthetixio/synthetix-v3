//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract SpotMarketRouter {
    error UnknownSelector(bytes4 sel);

    address private constant _OWNER_MODULE = 0xbfBCB152F232f4fC35649a57e4735f16Ab837140;
    address private constant _UPGRADE_MODULE = 0xBC494A7cdb4F82B10d8D8804f04C2Fb1286A4822;
    address private constant _SPOT_MARKET_FACTORY_MODULE = 0xD488d5DEbD92f62617EF0125Acaae461d1DD0680;
    address private constant _SPOT_MARKET_MODULE = 0x31F0E9bf0A1CD1ceF3DE1cD832AC307b07a66F2E;
    address private constant _WRAPPER_MODULE = 0x8aa9ae39D29c03E0Cd610dED3edb8a50757fef3a;

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
                    if lt(sig,0x3ec42906) {
                        switch sig
                        case 0x1627540c { result := _OWNER_MODULE } // OwnerModule.nominateNewOwner()
                        case 0x27b06405 { result := _WRAPPER_MODULE } // WrapperModule.initializeWrapper()
                        case 0x29408121 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.getSellQuote()
                        case 0x2d22bef9 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.initOrUpgradeNft()
                        case 0x2ded9bf5 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.upgradeSynthImpl()
                        case 0x35eb2824 { result := _OWNER_MODULE } // OwnerModule.isOwnerModuleInitialized()
                        case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                        case 0x392e53cd { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.isInitialized()
                        leave
                    }
                    switch sig
                    case 0x3ec42906 { result := _WRAPPER_MODULE } // WrapperModule.getWrapQuote()
                    case 0x485cc955 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.initialize()
                    case 0x49d7923e { result := _WRAPPER_MODULE } // WrapperModule.unwrap()
                    case 0x4e808b4a { result := _SPOT_MARKET_MODULE } // SpotMarketModule.getBuyQuote()
                    case 0x53a47bb7 { result := _OWNER_MODULE } // OwnerModule.nominatedOwner()
                    case 0x561a0fcf { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.updateFeeData()
                    case 0x60988e09 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.getAssociatedSystem()
                    case 0x624bd96d { result := _OWNER_MODULE } // OwnerModule.initializeOwnerModule()
                    leave
                }
                if lt(sig,0xbcec0d0f) {
                    switch sig
                    case 0x718fe928 { result := _OWNER_MODULE } // OwnerModule.renounceNomination()
                    case 0x71e51b64 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.registerSynth()
                    case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                    case 0x7aef1fb1 { result := _WRAPPER_MODULE } // WrapperModule.wrap()
                    case 0x8da5cb5b { result := _OWNER_MODULE } // OwnerModule.owner()
                    case 0x9244bbdc { result := _SPOT_MARKET_MODULE } // SpotMarketModule.buy()
                    case 0x9e4f1cb0 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.updatePriceData()
                    case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                    leave
                }
                switch sig
                case 0xbcec0d0f { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.reportedDebt()
                case 0xc624440a { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.name()
                case 0xc6f79537 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.initOrUpgradeToken()
                case 0xc7f62cda { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgradeTo()
                case 0xc9c04a7f { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.locked()
                case 0xd245d983 { result := _SPOT_MARKET_FACTORY_MODULE } // SpotMarketFactoryModule.registerUnmanagedSystem()
                case 0xdf362945 { result := _SPOT_MARKET_MODULE } // SpotMarketModule.sell()
                case 0xe73ff62b { result := _WRAPPER_MODULE } // WrapperModule.getUnwrapQuote()
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
