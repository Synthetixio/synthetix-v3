//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;


contract Router_kovan {
    // --------------------------------------------------------------------------------
    // --------------------------------------------------------------------------------
    // GENERATED CODE - do not edit manually
    // --------------------------------------------------------------------------------
    // --------------------------------------------------------------------------------

    fallback() external {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;
        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                let UpgradeModule := 0x8E3C115787FA05Ea526175Fa1b939d3b1F546314
                let SettingsModule := 0xC5778be11e8c03b8635D3F7b500E8C5436EA4C70
                let OwnerModule := 0x267ccE7a76e6a76D98D2022cc46E047451021248
                let AModule := 0xE6deF028B0D79497dC2E421526CF22673c563004
                let BModule := 0x4bD008A95C0D8Dc276644d3e1B653478136422FA
                let RegistryModule := 0x89D7B5891130Ef7566015188aeabc2dDec21F7D0

                if lt(sig,0x55241077) {
                    switch sig
                    case 0x13af4035 { result := OwnerModule } // OwnerModule.setOwner()
                    case 0x20965255 { result := BModule } // BModule.getValue()
                    case 0x3659cfe6 { result := UpgradeModule } // UpgradeModule.upgradeTo()
                    case 0x38536275 { result := SettingsModule } // SettingsModule.setMinCollateralRatio()
                    case 0x3d9673f5 { result := RegistryModule } // RegistryModule.getModuleImplementation()
                    case 0x49cf5a17 { result := RegistryModule } // RegistryModule.registerModules()
                    case 0x4c8f35ab { result := SettingsModule } // SettingsModule.getMinCollateralRatio()
                    leave
                }
                switch sig
                case 0x55241077 { result := BModule } // BModule.setValue()
                case 0x893d20e8 { result := OwnerModule } // OwnerModule.getOwner()
                case 0x8cb90714 { result := AModule } // AModule.setValueViaBModule_router()
                case 0xaaf10f42 { result := UpgradeModule } // UpgradeModule.getImplementation()
                case 0xd8d20484 { result := AModule } // AModule.setValueViaBModule_cast()
                case 0xdaa3a163 { result := UpgradeModule } // UpgradeModule.isUpgradeable()
                case 0xf21a9c0d { result := AModule } // AModule.setValueViaBModule_direct()
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

    // --------------------------------------------------------------------------------
    // --------------------------------------------------------------------------------
    // --------------------------------------------------------------------------------
    // --------------------------------------------------------------------------------
}
