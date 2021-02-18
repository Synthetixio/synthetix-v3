//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router_local {
    address constant AModule = 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318;
    address constant AnotherDummyModule = 0x610178dA211FEF7D417bC0e6FeD39F05609AD788;
    address constant BModule = 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e;
    address constant DummyModule = 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0;
    address constant OwnerModule = 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82;
    address constant SettingsModule = 0x9A676e781A523b5d0C0e43731313A708CB607508;
    address constant StatusModule = 0x0B306BF915C4d645ff596e518fAf3F9669b97016;
    address constant UpgradeModule = 0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1;
    address constant YetAnotherDummyModule = 0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE;

    fallback() external {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;
        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                if lt(sig,0x7fe07b98) {
                    if lt(sig,0x3df86c93) {
                        if lt(sig,0x1e732738) {
                            if lt(sig,0x0deb912a) {
                                if lt(sig,0x0a23e8f4) {
                                    if lt(sig,0x058ac67e) {
                                        if lt(sig,0x03e72fb4) {
                                            switch sig
                                            case 0x0008ccb8 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest84()
                                            case 0x0053d4a7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest180()
                                            case 0x019fc97b { result := AnotherDummyModule } // AnotherDummyModule.atest184()
                                            case 0x0267b565 { result := DummyModule } // DummyModule.test141()
                                            case 0x037daef6 { result := DummyModule } // DummyModule.test192()
                                            leave
                                        }
                                        switch sig
                                        case 0x03e72fb4 { result := AnotherDummyModule } // AnotherDummyModule.atest44()
                                        case 0x040b6012 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest126()
                                        case 0x0428e86c { result := AnotherDummyModule } // AnotherDummyModule.atest96()
                                        case 0x04d9f68a { result := AnotherDummyModule } // AnotherDummyModule.atest64()
                                        case 0x05845615 { result := AnotherDummyModule } // AnotherDummyModule.atest145()
                                        leave
                                    }
                                    if lt(sig,0x06fe01a4) {
                                        switch sig
                                        case 0x058ac67e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest182()
                                        case 0x05c63b08 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest131()
                                        case 0x0604f9ec { result := DummyModule } // DummyModule.test33()
                                        case 0x063fab2d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest45()
                                        case 0x06aee8b0 { result := AnotherDummyModule } // AnotherDummyModule.atest137()
                                        leave
                                    }
                                    switch sig
                                    case 0x06fe01a4 { result := DummyModule } // DummyModule.test40()
                                    case 0x072ae7ad { result := AnotherDummyModule } // AnotherDummyModule.atest54()
                                    case 0x07cf77df { result := DummyModule } // DummyModule.test122()
                                    case 0x091d511c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest25()
                                    case 0x09c8caf3 { result := DummyModule } // DummyModule.test135()
                                    leave
                                }
                                if lt(sig,0x0b9c3e61) {
                                    if lt(sig,0x0abc8882) {
                                        switch sig
                                        case 0x0a23e8f4 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest198()
                                        case 0x0a26b15f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest158()
                                        case 0x0a6cb1c0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest51()
                                        case 0x0a8e8e01 { result := DummyModule } // DummyModule.test3()
                                        case 0x0aa14760 { result := AnotherDummyModule } // AnotherDummyModule.atest132()
                                        leave
                                    }
                                    switch sig
                                    case 0x0abc8882 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest36()
                                    case 0x0ac421ac { result := DummyModule } // DummyModule.test82()
                                    case 0x0b2b5c57 { result := DummyModule } // DummyModule.test139()
                                    case 0x0b2f7235 { result := DummyModule } // DummyModule.test161()
                                    case 0x0b8b3746 { result := DummyModule } // DummyModule.test50()
                                    leave
                                }
                                switch sig
                                case 0x0b9c3e61 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest74()
                                case 0x0ba07746 { result := DummyModule } // DummyModule.test29()
                                case 0x0c1284a1 { result := DummyModule } // DummyModule.test36()
                                case 0x0c3bfdf1 { result := DummyModule } // DummyModule.test110()
                                case 0x0c53888d { result := AnotherDummyModule } // AnotherDummyModule.atest11()
                                case 0x0c8559b7 { result := DummyModule } // DummyModule.test112()
                                case 0x0cec7ed3 { result := DummyModule } // DummyModule.test107()
                                case 0x0d16ae61 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest4()
                                case 0x0d6123bb { result := AnotherDummyModule } // AnotherDummyModule.atest107()
                                leave
                            }
                            if lt(sig,0x1796bc52) {
                                if lt(sig,0x13c524e6) {
                                    if lt(sig,0x1279ca79) {
                                        switch sig
                                        case 0x0deb912a { result := AnotherDummyModule } // AnotherDummyModule.atest88()
                                        case 0x0e766dcb { result := AnotherDummyModule } // AnotherDummyModule.atest176()
                                        case 0x0f5d55b9 { result := DummyModule } // DummyModule.test131()
                                        case 0x117753d9 { result := DummyModule } // DummyModule.test35()
                                        case 0x123d8e48 { result := AnotherDummyModule } // AnotherDummyModule.atest4()
                                        leave
                                    }
                                    switch sig
                                    case 0x1279ca79 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest57()
                                    case 0x12911007 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest139()
                                    case 0x1349f79d { result := AnotherDummyModule } // AnotherDummyModule.atest165()
                                    case 0x13a0a330 { result := AnotherDummyModule } // AnotherDummyModule.atest3()
                                    case 0x13bbee09 { result := AnotherDummyModule } // AnotherDummyModule.atest102()
                                    leave
                                }
                                switch sig
                                case 0x13c524e6 { result := DummyModule } // DummyModule.test65()
                                case 0x1404e1e2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest121()
                                case 0x1462d42a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest52()
                                case 0x149b07fd { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest20()
                                case 0x1523bdb8 { result := DummyModule } // DummyModule.test144()
                                case 0x157c51d3 { result := StatusModule } // StatusModule.resumeSystem()
                                case 0x1634efa0 { result := DummyModule } // DummyModule.test117()
                                case 0x1713a1c0 { result := DummyModule } // DummyModule.test69()
                                case 0x176d2c99 { result := AnotherDummyModule } // AnotherDummyModule.atest178()
                                leave
                            }
                            if lt(sig,0x1b64c1a7) {
                                if lt(sig,0x192739fc) {
                                    switch sig
                                    case 0x1796bc52 { result := DummyModule } // DummyModule.test103()
                                    case 0x17cada76 { result := AnotherDummyModule } // AnotherDummyModule.atest80()
                                    case 0x17fb273f { result := AnotherDummyModule } // AnotherDummyModule.atest52()
                                    case 0x1881a722 { result := AnotherDummyModule } // AnotherDummyModule.atest115()
                                    case 0x18bde49d { result := DummyModule } // DummyModule.test184()
                                    leave
                                }
                                switch sig
                                case 0x192739fc { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest88()
                                case 0x1990b834 { result := DummyModule } // DummyModule.test51()
                                case 0x1aa0f661 { result := AnotherDummyModule } // AnotherDummyModule.atest159()
                                case 0x1ad7be82 { result := DummyModule } // DummyModule.test5()
                                case 0x1ae96275 { result := DummyModule } // DummyModule.test196()
                                leave
                            }
                            switch sig
                            case 0x1b64c1a7 { result := DummyModule } // DummyModule.test73()
                            case 0x1b9255bb { result := AnotherDummyModule } // AnotherDummyModule.atest190()
                            case 0x1c536743 { result := DummyModule } // DummyModule.test134()
                            case 0x1c6b857a { result := AnotherDummyModule } // AnotherDummyModule.atest61()
                            case 0x1c7b50ab { result := DummyModule } // DummyModule.test76()
                            case 0x1ca0bc33 { result := AnotherDummyModule } // AnotherDummyModule.atest85()
                            case 0x1cc76847 { result := AnotherDummyModule } // AnotherDummyModule.atest183()
                            case 0x1d2dcff2 { result := AnotherDummyModule } // AnotherDummyModule.atest92()
                            case 0x1e5e4055 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest135()
                            leave
                        }
                        if lt(sig,0x2fc9b712) {
                            if lt(sig,0x27487fb1) {
                                if lt(sig,0x23e83b8b) {
                                    if lt(sig,0x220eb482) {
                                        switch sig
                                        case 0x1e732738 { result := AnotherDummyModule } // AnotherDummyModule.atest108()
                                        case 0x1fa85301 { result := AnotherDummyModule } // AnotherDummyModule.atest155()
                                        case 0x20965255 { result := BModule } // BModule.getValue()
                                        case 0x21ceb296 { result := DummyModule } // DummyModule.test200()
                                        case 0x21f6e895 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest151()
                                        leave
                                    }
                                    switch sig
                                    case 0x220eb482 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest149()
                                    case 0x2268b1a6 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest113()
                                    case 0x22bd8351 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest22()
                                    case 0x23327258 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest13()
                                    case 0x2380fc09 { result := AnotherDummyModule } // AnotherDummyModule.atest167()
                                    leave
                                }
                                if lt(sig,0x252bb236) {
                                    switch sig
                                    case 0x23e83b8b { result := AnotherDummyModule } // AnotherDummyModule.atest17()
                                    case 0x245ea161 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest72()
                                    case 0x247f961b { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest47()
                                    case 0x248d9caa { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest80()
                                    case 0x2519d36a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest14()
                                    leave
                                }
                                switch sig
                                case 0x252bb236 { result := AnotherDummyModule } // AnotherDummyModule.atest69()
                                case 0x265d0930 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest170()
                                case 0x266bfd05 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest95()
                                case 0x26e48e69 { result := AnotherDummyModule } // AnotherDummyModule.atest168()
                                case 0x2704a8bd { result := DummyModule } // DummyModule.test189()
                                leave
                            }
                            if lt(sig,0x2c12dda2) {
                                if lt(sig,0x288b6a36) {
                                    switch sig
                                    case 0x27487fb1 { result := AnotherDummyModule } // AnotherDummyModule.atest2()
                                    case 0x274b46ef { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest152()
                                    case 0x2770c15f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest58()
                                    case 0x27c7067d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest125()
                                    case 0x287cdd04 { result := AnotherDummyModule } // AnotherDummyModule.atest50()
                                    leave
                                }
                                switch sig
                                case 0x288b6a36 { result := OwnerModule } // OwnerModule.getNominatedOwner()
                                case 0x28e805a0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest3()
                                case 0x2ad501b7 { result := AnotherDummyModule } // AnotherDummyModule.atest40()
                                case 0x2b0318c3 { result := AnotherDummyModule } // AnotherDummyModule.atest99()
                                case 0x2b6d7247 { result := DummyModule } // DummyModule.test164()
                                leave
                            }
                            switch sig
                            case 0x2c12dda2 { result := AnotherDummyModule } // AnotherDummyModule.atest39()
                            case 0x2c22938e { result := DummyModule } // DummyModule.test102()
                            case 0x2c5562e9 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest32()
                            case 0x2d4cbad5 { result := AnotherDummyModule } // AnotherDummyModule.atest8()
                            case 0x2e25ea3c { result := AnotherDummyModule } // AnotherDummyModule.atest130()
                            case 0x2ec4fabe { result := AnotherDummyModule } // AnotherDummyModule.atest73()
                            case 0x2ee29564 { result := DummyModule } // DummyModule.test151()
                            case 0x2f8f01e5 { result := AnotherDummyModule } // AnotherDummyModule.atest160()
                            case 0x2fa5ac36 { result := AnotherDummyModule } // AnotherDummyModule.atest149()
                            leave
                        }
                        if lt(sig,0x37db5fd2) {
                            if lt(sig,0x33f8c2de) {
                                if lt(sig,0x31394e6d) {
                                    switch sig
                                    case 0x2fc9b712 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest67()
                                    case 0x2fd9abb4 { result := DummyModule } // DummyModule.test166()
                                    case 0x3059ba55 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest30()
                                    case 0x30889a63 { result := DummyModule } // DummyModule.test169()
                                    case 0x30f0cb77 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest1()
                                    leave
                                }
                                switch sig
                                case 0x31394e6d { result := DummyModule } // DummyModule.test114()
                                case 0x319ceddf { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest109()
                                case 0x31de6197 { result := DummyModule } // DummyModule.test106()
                                case 0x32a133c7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest177()
                                case 0x33a1393b { result := AnotherDummyModule } // AnotherDummyModule.atest112()
                                leave
                            }
                            switch sig
                            case 0x33f8c2de { result := AnotherDummyModule } // AnotherDummyModule.atest23()
                            case 0x34dfe75e { result := DummyModule } // DummyModule.test146()
                            case 0x34f18294 { result := AnotherDummyModule } // AnotherDummyModule.atest48()
                            case 0x35c4e523 { result := AnotherDummyModule } // AnotherDummyModule.atest173()
                            case 0x3609cf96 { result := AnotherDummyModule } // AnotherDummyModule.atest152()
                            case 0x3628dc3e { result := DummyModule } // DummyModule.test198()
                            case 0x3659cfe6 { result := UpgradeModule } // UpgradeModule.upgradeTo()
                            case 0x3759d9e0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest142()
                            case 0x37a6b1fd { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest159()
                            leave
                        }
                        if lt(sig,0x3b63dd81) {
                            if lt(sig,0x38af664d) {
                                switch sig
                                case 0x37db5fd2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest105()
                                case 0x37e5d945 { result := AnotherDummyModule } // AnotherDummyModule.atest60()
                                case 0x38536275 { result := SettingsModule } // SettingsModule.setMinCollateralRatio()
                                case 0x38678ee6 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest137()
                                case 0x388d1e8c { result := DummyModule } // DummyModule.test159()
                                leave
                            }
                            switch sig
                            case 0x38af664d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest119()
                            case 0x38b56acb { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest117()
                            case 0x39479ed7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest161()
                            case 0x3aecb743 { result := AnotherDummyModule } // AnotherDummyModule.atest105()
                            case 0x3b18797e { result := AnotherDummyModule } // AnotherDummyModule.atest31()
                            leave
                        }
                        switch sig
                        case 0x3b63dd81 { result := AnotherDummyModule } // AnotherDummyModule.atest15()
                        case 0x3b75b5fb { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest118()
                        case 0x3c78cdb6 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest37()
                        case 0x3cc45e66 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest123()
                        case 0x3ce6f0fa { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest19()
                        case 0x3d16ed2c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest166()
                        case 0x3d6456dd { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest50()
                        case 0x3d92ff87 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest167()
                        case 0x3db04260 { result := DummyModule } // DummyModule.test60()
                        leave
                    }
                    if lt(sig,0x5f06cffb) {
                        if lt(sig,0x4dc5f7d9) {
                            if lt(sig,0x45cbce97) {
                                if lt(sig,0x425b671f) {
                                    if lt(sig,0x3eab5c7e) {
                                        switch sig
                                        case 0x3df86c93 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest120()
                                        case 0x3e0ebe7f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest28()
                                        case 0x3e83060f { result := AnotherDummyModule } // AnotherDummyModule.atest70()
                                        case 0x3e898097 { result := AnotherDummyModule } // AnotherDummyModule.atest106()
                                        case 0x3ea27b3e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest116()
                                        leave
                                    }
                                    switch sig
                                    case 0x3eab5c7e { result := AnotherDummyModule } // AnotherDummyModule.atest161()
                                    case 0x3f4bfff3 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest115()
                                    case 0x4189d6d5 { result := AnotherDummyModule } // AnotherDummyModule.atest86()
                                    case 0x41ef3738 { result := DummyModule } // DummyModule.test13()
                                    case 0x42289fbe { result := DummyModule } // DummyModule.test63()
                                    leave
                                }
                                if lt(sig,0x44908ff2) {
                                    switch sig
                                    case 0x425b671f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest122()
                                    case 0x4261d28a { result := DummyModule } // DummyModule.test187()
                                    case 0x4316683f { result := AnotherDummyModule } // AnotherDummyModule.atest27()
                                    case 0x43178289 { result := DummyModule } // DummyModule.test155()
                                    case 0x43c77d51 { result := DummyModule } // DummyModule.test67()
                                    leave
                                }
                                switch sig
                                case 0x44908ff2 { result := AnotherDummyModule } // AnotherDummyModule.atest146()
                                case 0x44f8cc31 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest90()
                                case 0x4535eecf { result := DummyModule } // DummyModule.test80()
                                case 0x4579ba59 { result := DummyModule } // DummyModule.test74()
                                case 0x45b7d7c7 { result := AnotherDummyModule } // AnotherDummyModule.atest185()
                                leave
                            }
                            if lt(sig,0x49e05baf) {
                                if lt(sig,0x47cf780f) {
                                    switch sig
                                    case 0x45cbce97 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest33()
                                    case 0x46965e44 { result := AnotherDummyModule } // AnotherDummyModule.atest63()
                                    case 0x46b210eb { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest110()
                                    case 0x46cdf535 { result := AnotherDummyModule } // AnotherDummyModule.atest148()
                                    case 0x47983ee7 { result := AnotherDummyModule } // AnotherDummyModule.atest49()
                                    leave
                                }
                                switch sig
                                case 0x47cf780f { result := DummyModule } // DummyModule.test58()
                                case 0x481373e7 { result := AnotherDummyModule } // AnotherDummyModule.atest77()
                                case 0x4863a380 { result := AnotherDummyModule } // AnotherDummyModule.atest166()
                                case 0x4864ea4a { result := DummyModule } // DummyModule.test94()
                                case 0x4997dced { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest174()
                                leave
                            }
                            switch sig
                            case 0x49e05baf { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest194()
                            case 0x4aad04f5 { result := AnotherDummyModule } // AnotherDummyModule.atest114()
                            case 0x4b473abe { result := DummyModule } // DummyModule.test125()
                            case 0x4b72490b { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest112()
                            case 0x4c6ccd63 { result := AnotherDummyModule } // AnotherDummyModule.atest7()
                            case 0x4c8f35ab { result := SettingsModule } // SettingsModule.getMinCollateralRatio()
                            case 0x4cbeb293 { result := DummyModule } // DummyModule.test162()
                            case 0x4d3b0cfa { result := DummyModule } // DummyModule.test101()
                            case 0x4d6f0b30 { result := AnotherDummyModule } // AnotherDummyModule.atest10()
                            leave
                        }
                        if lt(sig,0x58d47998) {
                            if lt(sig,0x546b486d) {
                                if lt(sig,0x5144dc2b) {
                                    switch sig
                                    case 0x4dc5f7d9 { result := DummyModule } // DummyModule.test136()
                                    case 0x4e0a93ac { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest168()
                                    case 0x501c7bf6 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest187()
                                    case 0x504e8ad8 { result := DummyModule } // DummyModule.test174()
                                    case 0x50fe6976 { result := AnotherDummyModule } // AnotherDummyModule.atest123()
                                    leave
                                }
                                switch sig
                                case 0x5144dc2b { result := DummyModule } // DummyModule.test168()
                                case 0x516fafce { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest35()
                                case 0x51b42d41 { result := AnotherDummyModule } // AnotherDummyModule.atest28()
                                case 0x51d81152 { result := DummyModule } // DummyModule.test160()
                                case 0x52fb8013 { result := DummyModule } // DummyModule.test39()
                                leave
                            }
                            switch sig
                            case 0x546b486d { result := DummyModule } // DummyModule.test48()
                            case 0x55241077 { result := BModule } // BModule.setValue()
                            case 0x558cb882 { result := DummyModule } // DummyModule.test26()
                            case 0x564b8e90 { result := AnotherDummyModule } // AnotherDummyModule.atest125()
                            case 0x56a9d72d { result := AnotherDummyModule } // AnotherDummyModule.atest200()
                            case 0x571b0004 { result := DummyModule } // DummyModule.test132()
                            case 0x5759ea31 { result := DummyModule } // DummyModule.test149()
                            case 0x5759ee97 { result := DummyModule } // DummyModule.test128()
                            case 0x581c2eaf { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest189()
                            leave
                        }
                        if lt(sig,0x5c35e0b0) {
                            if lt(sig,0x5a922514) {
                                switch sig
                                case 0x58d47998 { result := AnotherDummyModule } // AnotherDummyModule.atest189()
                                case 0x5915f84f { result := DummyModule } // DummyModule.test154()
                                case 0x5924ceba { result := AnotherDummyModule } // AnotherDummyModule.atest83()
                                case 0x598a665d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest40()
                                case 0x59de7c24 { result := DummyModule } // DummyModule.test185()
                                leave
                            }
                            switch sig
                            case 0x5a922514 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest60()
                            case 0x5aaa0a4d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest128()
                            case 0x5b1eee3d { result := AnotherDummyModule } // AnotherDummyModule.atest38()
                            case 0x5b94db27 { result := OwnerModule } // OwnerModule.nominateOwner()
                            case 0x5bab9fff { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest186()
                            leave
                        }
                        switch sig
                        case 0x5c35e0b0 { result := AnotherDummyModule } // AnotherDummyModule.atest45()
                        case 0x5c5fbbce { result := DummyModule } // DummyModule.test194()
                        case 0x5c8af377 { result := AnotherDummyModule } // AnotherDummyModule.atest147()
                        case 0x5cccc8e2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest5()
                        case 0x5dab6de8 { result := DummyModule } // DummyModule.test158()
                        case 0x5e296104 { result := DummyModule } // DummyModule.test75()
                        case 0x5e2b9c3b { result := AnotherDummyModule } // AnotherDummyModule.atest120()
                        case 0x5e40377f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest145()
                        case 0x5e54e982 { result := DummyModule } // DummyModule.test23()
                        leave
                    }
                    if lt(sig,0x6dd43bce) {
                        if lt(sig,0x66e84d62) {
                            if lt(sig,0x6305c668) {
                                if lt(sig,0x60c4c3bb) {
                                    switch sig
                                    case 0x5f06cffb { result := AnotherDummyModule } // AnotherDummyModule.atest124()
                                    case 0x5f1014c1 { result := DummyModule } // DummyModule.test105()
                                    case 0x5f63670e { result := AnotherDummyModule } // AnotherDummyModule.atest53()
                                    case 0x5f6f7b7a { result := DummyModule } // DummyModule.test79()
                                    case 0x6015679d { result := AnotherDummyModule } // AnotherDummyModule.atest154()
                                    leave
                                }
                                switch sig
                                case 0x60c4c3bb { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest9()
                                case 0x60d3cdcb { result := DummyModule } // DummyModule.test92()
                                case 0x6121490e { result := DummyModule } // DummyModule.test41()
                                case 0x62debfd7 { result := AnotherDummyModule } // AnotherDummyModule.atest131()
                                case 0x62ffbcd7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest178()
                                leave
                            }
                            if lt(sig,0x6594b108) {
                                switch sig
                                case 0x6305c668 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest10()
                                case 0x64486b3d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest146()
                                case 0x64f892ff { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest2()
                                case 0x651ef3a6 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest188()
                                case 0x657d314c { result := AnotherDummyModule } // AnotherDummyModule.atest46()
                                leave
                            }
                            switch sig
                            case 0x6594b108 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest184()
                            case 0x668f34f6 { result := AnotherDummyModule } // AnotherDummyModule.atest30()
                            case 0x66db6bd0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest136()
                            case 0x66e0b067 { result := DummyModule } // DummyModule.test32()
                            case 0x66e41cb7 { result := DummyModule } // DummyModule.test2()
                            leave
                        }
                        if lt(sig,0x6bf36768) {
                            if lt(sig,0x69f791b0) {
                                switch sig
                                case 0x66e84d62 { result := DummyModule } // DummyModule.test7()
                                case 0x66ff9609 { result := AnotherDummyModule } // AnotherDummyModule.atest116()
                                case 0x691089b7 { result := AnotherDummyModule } // AnotherDummyModule.atest157()
                                case 0x69aa5b0a { result := AnotherDummyModule } // AnotherDummyModule.atest14()
                                case 0x69b012fb { result := AnotherDummyModule } // AnotherDummyModule.atest126()
                                leave
                            }
                            switch sig
                            case 0x69f791b0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest106()
                            case 0x6a00c911 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest143()
                            case 0x6b59084d { result := DummyModule } // DummyModule.test1()
                            case 0x6b806f30 { result := AnotherDummyModule } // AnotherDummyModule.atest134()
                            case 0x6bc20481 { result := DummyModule } // DummyModule.test77()
                            leave
                        }
                        switch sig
                        case 0x6bf36768 { result := AnotherDummyModule } // AnotherDummyModule.atest121()
                        case 0x6c4d4b9c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest127()
                        case 0x6c728cab { result := DummyModule } // DummyModule.test119()
                        case 0x6cbe342d { result := AnotherDummyModule } // AnotherDummyModule.atest20()
                        case 0x6d2b6034 { result := DummyModule } // DummyModule.test137()
                        case 0x6d44940c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest179()
                        case 0x6d964a32 { result := DummyModule } // DummyModule.test176()
                        case 0x6d96c5c1 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest97()
                        case 0x6dc87a90 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest107()
                        leave
                    }
                    if lt(sig,0x77100ab3) {
                        if lt(sig,0x74e05cf3) {
                            if lt(sig,0x7203c32e) {
                                switch sig
                                case 0x6dd43bce { result := AnotherDummyModule } // AnotherDummyModule.atest179()
                                case 0x6f0befdc { result := DummyModule } // DummyModule.test34()
                                case 0x6f3babc4 { result := DummyModule } // DummyModule.test6()
                                case 0x70c88441 { result := AnotherDummyModule } // AnotherDummyModule.atest136()
                                case 0x719fcbbe { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest56()
                                leave
                            }
                            switch sig
                            case 0x7203c32e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest29()
                            case 0x72c55381 { result := DummyModule } // DummyModule.test157()
                            case 0x72c66f4a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest195()
                            case 0x73609544 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest42()
                            case 0x746831ee { result := DummyModule } // DummyModule.test86()
                            leave
                        }
                        switch sig
                        case 0x74e05cf3 { result := DummyModule } // DummyModule.test179()
                        case 0x751d4a8c { result := DummyModule } // DummyModule.test87()
                        case 0x75c17379 { result := AnotherDummyModule } // AnotherDummyModule.atest139()
                        case 0x76049cf2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest26()
                        case 0x7639747e { result := DummyModule } // DummyModule.test72()
                        case 0x765c58c7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest171()
                        case 0x766d9deb { result := DummyModule } // DummyModule.test81()
                        case 0x76c03ff0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest156()
                        case 0x76e2561e { result := AnotherDummyModule } // AnotherDummyModule.atest42()
                        leave
                    }
                    if lt(sig,0x7afbef93) {
                        if lt(sig,0x797201ec) {
                            switch sig
                            case 0x77100ab3 { result := DummyModule } // DummyModule.test120()
                            case 0x77893a96 { result := DummyModule } // DummyModule.test163()
                            case 0x77c335f5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest133()
                            case 0x781524ac { result := DummyModule } // DummyModule.test167()
                            case 0x7839c9a0 { result := DummyModule } // DummyModule.test10()
                            leave
                        }
                        switch sig
                        case 0x797201ec { result := DummyModule } // DummyModule.test68()
                        case 0x79ba5097 { result := OwnerModule } // OwnerModule.acceptOwnership()
                        case 0x7a2361ae { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest196()
                        case 0x7a786a55 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest59()
                        case 0x7ae2bf13 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest64()
                        leave
                    }
                    switch sig
                    case 0x7afbef93 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest87()
                    case 0x7baa594f { result := DummyModule } // DummyModule.test89()
                    case 0x7bf046e6 { result := AnotherDummyModule } // AnotherDummyModule.atest182()
                    case 0x7c743b8e { result := DummyModule } // DummyModule.test178()
                    case 0x7ddf90f5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest108()
                    case 0x7dede27c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest68()
                    case 0x7ea1b3c1 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest71()
                    case 0x7f8b70df { result := AnotherDummyModule } // AnotherDummyModule.atest51()
                    case 0x7fb68261 { result := DummyModule } // DummyModule.test57()
                    leave
                }
                if lt(sig,0xc140898c) {
                    if lt(sig,0xa29e93b1) {
                        if lt(sig,0x9008b69c) {
                            if lt(sig,0x88047848) {
                                if lt(sig,0x82aaf544) {
                                    if lt(sig,0x80b50830) {
                                        switch sig
                                        case 0x7fe07b98 { result := AnotherDummyModule } // AnotherDummyModule.atest127()
                                        case 0x7fe5f2c4 { result := AnotherDummyModule } // AnotherDummyModule.atest151()
                                        case 0x80297e0a { result := DummyModule } // DummyModule.test83()
                                        case 0x8099b6bb { result := AnotherDummyModule } // AnotherDummyModule.atest172()
                                        case 0x80aa29b2 { result := AnotherDummyModule } // AnotherDummyModule.atest174()
                                        leave
                                    }
                                    switch sig
                                    case 0x80b50830 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest130()
                                    case 0x810b2ab5 { result := DummyModule } // DummyModule.test27()
                                    case 0x82139adc { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest69()
                                    case 0x821d1a40 { result := DummyModule } // DummyModule.test152()
                                    case 0x8227925f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest99()
                                    leave
                                }
                                if lt(sig,0x8397ca65) {
                                    switch sig
                                    case 0x82aaf544 { result := DummyModule } // DummyModule.test30()
                                    case 0x82bf29d5 { result := AnotherDummyModule } // AnotherDummyModule.atest36()
                                    case 0x82f7cdef { result := AnotherDummyModule } // AnotherDummyModule.atest150()
                                    case 0x8342a5cf { result := AnotherDummyModule } // AnotherDummyModule.atest21()
                                    case 0x8396ad12 { result := AnotherDummyModule } // AnotherDummyModule.atest101()
                                    leave
                                }
                                switch sig
                                case 0x8397ca65 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest197()
                                case 0x8410c6b9 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest48()
                                case 0x84dbbb77 { result := AnotherDummyModule } // AnotherDummyModule.atest66()
                                case 0x85005407 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest94()
                                case 0x85fed62c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest164()
                                leave
                            }
                            if lt(sig,0x8d6228aa) {
                                if lt(sig,0x8b8306f0) {
                                    switch sig
                                    case 0x88047848 { result := DummyModule } // DummyModule.test118()
                                    case 0x8897c78d { result := AnotherDummyModule } // AnotherDummyModule.atest188()
                                    case 0x893d20e8 { result := OwnerModule } // OwnerModule.getOwner()
                                    case 0x8a50926a { result := AnotherDummyModule } // AnotherDummyModule.atest55()
                                    case 0x8af486ad { result := DummyModule } // DummyModule.test177()
                                    leave
                                }
                                switch sig
                                case 0x8b8306f0 { result := AnotherDummyModule } // AnotherDummyModule.atest169()
                                case 0x8b8399ea { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest100()
                                case 0x8cb90714 { result := AModule } // AModule.setValueViaBModule_router()
                                case 0x8cc54c5c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest153()
                                case 0x8cdfbb89 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest82()
                                leave
                            }
                            switch sig
                            case 0x8d6228aa { result := AnotherDummyModule } // AnotherDummyModule.atest78()
                            case 0x8d9bc874 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest62()
                            case 0x8df2341b { result := DummyModule } // DummyModule.test47()
                            case 0x8e876de6 { result := StatusModule } // StatusModule.suspendSystem()
                            case 0x8ec180b8 { result := AnotherDummyModule } // AnotherDummyModule.atest24()
                            case 0x8f0d282d { result := DummyModule } // DummyModule.test4()
                            case 0x8f62e3f6 { result := AnotherDummyModule } // AnotherDummyModule.atest141()
                            case 0x8f834288 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest102()
                            case 0x8f95d39e { result := AnotherDummyModule } // AnotherDummyModule.atest198()
                            leave
                        }
                        if lt(sig,0x97d78182) {
                            if lt(sig,0x9441417c) {
                                if lt(sig,0x916d83db) {
                                    switch sig
                                    case 0x9008b69c { result := AnotherDummyModule } // AnotherDummyModule.atest129()
                                    case 0x903d7c90 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest138()
                                    case 0x90bfff4d { result := DummyModule } // DummyModule.test183()
                                    case 0x91092f9e { result := AnotherDummyModule } // AnotherDummyModule.atest180()
                                    case 0x91642af2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest172()
                                    leave
                                }
                                switch sig
                                case 0x916d83db { result := DummyModule } // DummyModule.test52()
                                case 0x92862d99 { result := AnotherDummyModule } // AnotherDummyModule.atest195()
                                case 0x92c5d564 { result := AnotherDummyModule } // AnotherDummyModule.atest91()
                                case 0x930bb66a { result := AnotherDummyModule } // AnotherDummyModule.atest58()
                                case 0x93b968a7 { result := AnotherDummyModule } // AnotherDummyModule.atest59()
                                leave
                            }
                            switch sig
                            case 0x9441417c { result := DummyModule } // DummyModule.test142()
                            case 0x944ba554 { result := UpgradeModule } // UpgradeModule.canUpgradeAgain()
                            case 0x9455da98 { result := DummyModule } // DummyModule.test148()
                            case 0x948a7835 { result := AnotherDummyModule } // AnotherDummyModule.atest142()
                            case 0x94e41392 { result := DummyModule } // DummyModule.test188()
                            case 0x9591aa82 { result := DummyModule } // DummyModule.test16()
                            case 0x95a1cbf3 { result := DummyModule } // DummyModule.test172()
                            case 0x95b39ad0 { result := AnotherDummyModule } // AnotherDummyModule.atest12()
                            case 0x9649e66e { result := AnotherDummyModule } // AnotherDummyModule.atest75()
                            leave
                        }
                        if lt(sig,0x9df17257) {
                            if lt(sig,0x9b05d57e) {
                                switch sig
                                case 0x97d78182 { result := DummyModule } // DummyModule.test49()
                                case 0x98f32fd8 { result := DummyModule } // DummyModule.test62()
                                case 0x99f90a30 { result := DummyModule } // DummyModule.test191()
                                case 0x9ad4c96f { result := OwnerModule } // OwnerModule.rejectNomination()
                                case 0x9ad66fcd { result := AnotherDummyModule } // AnotherDummyModule.atest162()
                                leave
                            }
                            switch sig
                            case 0x9b05d57e { result := AnotherDummyModule } // AnotherDummyModule.atest103()
                            case 0x9ba7bf69 { result := DummyModule } // DummyModule.test180()
                            case 0x9c32ad15 { result := AnotherDummyModule } // AnotherDummyModule.atest87()
                            case 0x9c6c82ff { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest65()
                            case 0x9d52baf5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest54()
                            leave
                        }
                        switch sig
                        case 0x9df17257 { result := DummyModule } // DummyModule.test95()
                        case 0x9ea0d553 { result := StatusModule } // StatusModule.isSystemSuspended()
                        case 0x9ed3371b { result := DummyModule } // DummyModule.test90()
                        case 0x9eeaa0c1 { result := AnotherDummyModule } // AnotherDummyModule.atest47()
                        case 0x9f21bf14 { result := AnotherDummyModule } // AnotherDummyModule.atest56()
                        case 0x9f34c135 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest124()
                        case 0x9f4333fd { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest175()
                        case 0xa18aa705 { result := DummyModule } // DummyModule.test175()
                        case 0xa1ca68bd { result := DummyModule } // DummyModule.test22()
                        leave
                    }
                    if lt(sig,0xb214dcab) {
                        if lt(sig,0xa7deec92) {
                            if lt(sig,0xa5e124eb) {
                                if lt(sig,0xa44cae6e) {
                                    switch sig
                                    case 0xa29e93b1 { result := AnotherDummyModule } // AnotherDummyModule.atest25()
                                    case 0xa2b5080c { result := DummyModule } // DummyModule.test116()
                                    case 0xa2dbcf58 { result := AnotherDummyModule } // AnotherDummyModule.atest16()
                                    case 0xa31b50a7 { result := AnotherDummyModule } // AnotherDummyModule.atest119()
                                    case 0xa38e33ab { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest63()
                                    leave
                                }
                                switch sig
                                case 0xa44cae6e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest103()
                                case 0xa45ee043 { result := AnotherDummyModule } // AnotherDummyModule.atest41()
                                case 0xa48a3e5e { result := DummyModule } // DummyModule.test108()
                                case 0xa54ab7d0 { result := AnotherDummyModule } // AnotherDummyModule.atest164()
                                case 0xa5c5b0c7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest140()
                                leave
                            }
                            if lt(sig,0xa685577a) {
                                switch sig
                                case 0xa5e124eb { result := DummyModule } // DummyModule.test21()
                                case 0xa5fd5db5 { result := AnotherDummyModule } // AnotherDummyModule.atest140()
                                case 0xa62974e9 { result := DummyModule } // DummyModule.test138()
                                case 0xa631c872 { result := DummyModule } // DummyModule.test115()
                                case 0xa63289f3 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest169()
                                leave
                            }
                            switch sig
                            case 0xa685577a { result := AnotherDummyModule } // AnotherDummyModule.atest117()
                            case 0xa6d4481c { result := DummyModule } // DummyModule.test70()
                            case 0xa7646577 { result := AnotherDummyModule } // AnotherDummyModule.atest84()
                            case 0xa791bb35 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest41()
                            case 0xa7986f08 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest8()
                            leave
                        }
                        if lt(sig,0xacff0bbd) {
                            if lt(sig,0xab6a895f) {
                                switch sig
                                case 0xa7deec92 { result := DummyModule } // DummyModule.test9()
                                case 0xa88326ba { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest75()
                                case 0xa8c9aed8 { result := AnotherDummyModule } // AnotherDummyModule.atest111()
                                case 0xa9db9f56 { result := DummyModule } // DummyModule.test121()
                                case 0xaaf10f42 { result := UpgradeModule } // UpgradeModule.getImplementation()
                                leave
                            }
                            switch sig
                            case 0xab6a895f { result := AnotherDummyModule } // AnotherDummyModule.atest191()
                            case 0xab7adb1d { result := DummyModule } // DummyModule.test186()
                            case 0xac3fa560 { result := DummyModule } // DummyModule.test88()
                            case 0xac47793a { result := DummyModule } // DummyModule.test38()
                            case 0xac9f63d2 { result := AnotherDummyModule } // AnotherDummyModule.atest143()
                            leave
                        }
                        switch sig
                        case 0xacff0bbd { result := DummyModule } // DummyModule.test153()
                        case 0xadfb8d35 { result := AnotherDummyModule } // AnotherDummyModule.atest193()
                        case 0xae064517 { result := AnotherDummyModule } // AnotherDummyModule.atest194()
                        case 0xae081057 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest61()
                        case 0xb00cd2d0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest76()
                        case 0xb06335e7 { result := DummyModule } // DummyModule.test44()
                        case 0xb079af8e { result := DummyModule } // DummyModule.test24()
                        case 0xb0c4c0d5 { result := DummyModule } // DummyModule.test31()
                        case 0xb191e898 { result := DummyModule } // DummyModule.test84()
                        leave
                    }
                    if lt(sig,0xb9b7bd10) {
                        if lt(sig,0xb57691c2) {
                            if lt(sig,0xb3362764) {
                                switch sig
                                case 0xb214dcab { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest101()
                                case 0xb23d404c { result := DummyModule } // DummyModule.test18()
                                case 0xb27fa207 { result := AnotherDummyModule } // AnotherDummyModule.atest156()
                                case 0xb2d63b8b { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest129()
                                case 0xb31b5088 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest144()
                                leave
                            }
                            switch sig
                            case 0xb3362764 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest31()
                            case 0xb3a92044 { result := DummyModule } // DummyModule.test28()
                            case 0xb3de6ce4 { result := AnotherDummyModule } // AnotherDummyModule.atest72()
                            case 0xb415aa00 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest16()
                            case 0xb4bb22f1 { result := AnotherDummyModule } // AnotherDummyModule.atest110()
                            leave
                        }
                        switch sig
                        case 0xb57691c2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest181()
                        case 0xb5a44554 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest155()
                        case 0xb5ac9d1a { result := AnotherDummyModule } // AnotherDummyModule.atest175()
                        case 0xb702591b { result := DummyModule } // DummyModule.test61()
                        case 0xb8407f7f { result := AnotherDummyModule } // AnotherDummyModule.atest122()
                        case 0xb86de8c8 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest24()
                        case 0xb90c4034 { result := DummyModule } // DummyModule.test123()
                        case 0xb911f0f7 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest185()
                        case 0xb99f4204 { result := DummyModule } // DummyModule.test97()
                        leave
                    }
                    if lt(sig,0xbe70efeb) {
                        if lt(sig,0xbb3e0a72) {
                            switch sig
                            case 0xb9b7bd10 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest34()
                            case 0xb9f6c7aa { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest183()
                            case 0xba12ce5a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest150()
                            case 0xba589dfd { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest92()
                            case 0xbb008802 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest89()
                            leave
                        }
                        switch sig
                        case 0xbb3e0a72 { result := AnotherDummyModule } // AnotherDummyModule.atest68()
                        case 0xbc7e7e1d { result := DummyModule } // DummyModule.test156()
                        case 0xbd66bb45 { result := AnotherDummyModule } // AnotherDummyModule.atest90()
                        case 0xbdb8a4c7 { result := DummyModule } // DummyModule.test171()
                        case 0xbe08e12b { result := DummyModule } // DummyModule.test43()
                        leave
                    }
                    switch sig
                    case 0xbe70efeb { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest165()
                    case 0xbede07ca { result := AnotherDummyModule } // AnotherDummyModule.atest171()
                    case 0xbf018554 { result := DummyModule } // DummyModule.test45()
                    case 0xbf20eacc { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest78()
                    case 0xbf74d041 { result := DummyModule } // DummyModule.test109()
                    case 0xbf84448a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest70()
                    case 0xbff5b595 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest81()
                    case 0xc06a0a7f { result := DummyModule } // DummyModule.test147()
                    case 0xc0828b34 { result := AnotherDummyModule } // AnotherDummyModule.atest57()
                    leave
                }
                if lt(sig,0xdcfe739c) {
                    if lt(sig,0xce6afb8d) {
                        if lt(sig,0xc7ad392f) {
                            if lt(sig,0xc40c0aa0) {
                                if lt(sig,0xc38f6f0b) {
                                    switch sig
                                    case 0xc140898c { result := AnotherDummyModule } // AnotherDummyModule.atest89()
                                    case 0xc224a44a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest191()
                                    case 0xc24f969a { result := AnotherDummyModule } // AnotherDummyModule.atest192()
                                    case 0xc351ad9a { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest134()
                                    case 0xc38f5b3b { result := DummyModule } // DummyModule.test85()
                                    leave
                                }
                                switch sig
                                case 0xc38f6f0b { result := DummyModule } // DummyModule.test8()
                                case 0xc3c9313c { result := AnotherDummyModule } // AnotherDummyModule.atest81()
                                case 0xc3d23565 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest163()
                                case 0xc3d285a4 { result := AnotherDummyModule } // AnotherDummyModule.atest33()
                                case 0xc3eb0cea { result := AnotherDummyModule } // AnotherDummyModule.atest109()
                                leave
                            }
                            if lt(sig,0xc5f8f031) {
                                switch sig
                                case 0xc40c0aa0 { result := DummyModule } // DummyModule.test190()
                                case 0xc43c0a65 { result := AnotherDummyModule } // AnotherDummyModule.atest98()
                                case 0xc46f47ea { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest39()
                                case 0xc52b4f25 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest148()
                                case 0xc5cc2d1a { result := AnotherDummyModule } // AnotherDummyModule.atest144()
                                leave
                            }
                            switch sig
                            case 0xc5f8f031 { result := DummyModule } // DummyModule.test14()
                            case 0xc6e5ce44 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest193()
                            case 0xc792d07f { result := DummyModule } // DummyModule.test170()
                            case 0xc79e3b48 { result := DummyModule } // DummyModule.test99()
                            case 0xc7aaa990 { result := AnotherDummyModule } // AnotherDummyModule.atest95()
                            leave
                        }
                        if lt(sig,0xcb09a175) {
                            if lt(sig,0xc9d16d5b) {
                                switch sig
                                case 0xc7ad392f { result := DummyModule } // DummyModule.test46()
                                case 0xc84fa477 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest38()
                                case 0xc857c159 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest27()
                                case 0xc86dec3f { result := AnotherDummyModule } // AnotherDummyModule.atest34()
                                case 0xc98588ec { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest96()
                                leave
                            }
                            switch sig
                            case 0xc9d16d5b { result := AnotherDummyModule } // AnotherDummyModule.atest181()
                            case 0xca35b775 { result := DummyModule } // DummyModule.test19()
                            case 0xcac6b1f3 { result := AnotherDummyModule } // AnotherDummyModule.atest65()
                            case 0xcaf60cf7 { result := AnotherDummyModule } // AnotherDummyModule.atest158()
                            case 0xcafb8632 { result := AnotherDummyModule } // AnotherDummyModule.atest62()
                            leave
                        }
                        switch sig
                        case 0xcb09a175 { result := AnotherDummyModule } // AnotherDummyModule.atest1()
                        case 0xcc1a127e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest141()
                        case 0xcc1c4819 { result := DummyModule } // DummyModule.test96()
                        case 0xcc616260 { result := AnotherDummyModule } // AnotherDummyModule.atest153()
                        case 0xccb22ea7 { result := AnotherDummyModule } // AnotherDummyModule.atest32()
                        case 0xcce34526 { result := DummyModule } // DummyModule.test197()
                        case 0xcdd2350d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest85()
                        case 0xcddfedb2 { result := AnotherDummyModule } // AnotherDummyModule.atest100()
                        case 0xce32d1c3 { result := DummyModule } // DummyModule.test37()
                        leave
                    }
                    if lt(sig,0xd5c34e4b) {
                        if lt(sig,0xd2d70754) {
                            if lt(sig,0xd0c1c5a5) {
                                switch sig
                                case 0xce6afb8d { result := DummyModule } // DummyModule.test93()
                                case 0xcf1848a0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest173()
                                case 0xcf8385bb { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest154()
                                case 0xd07ae416 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest147()
                                case 0xd09e4a3a { result := AnotherDummyModule } // AnotherDummyModule.atest82()
                                leave
                            }
                            switch sig
                            case 0xd0c1c5a5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest23()
                            case 0xd1804ae5 { result := AnotherDummyModule } // AnotherDummyModule.atest26()
                            case 0xd1a9f809 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest73()
                            case 0xd1db2d54 { result := DummyModule } // DummyModule.test64()
                            case 0xd2b1eea2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest21()
                            leave
                        }
                        switch sig
                        case 0xd2d70754 { result := DummyModule } // DummyModule.test100()
                        case 0xd2feb1f8 { result := AnotherDummyModule } // AnotherDummyModule.atest67()
                        case 0xd303caa9 { result := DummyModule } // DummyModule.test193()
                        case 0xd3833cd3 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest7()
                        case 0xd4781cfa { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest162()
                        case 0xd4a95c13 { result := DummyModule } // DummyModule.test54()
                        case 0xd4bad72a { result := DummyModule } // DummyModule.test12()
                        case 0xd5067479 { result := DummyModule } // DummyModule.test173()
                        case 0xd5450e21 { result := DummyModule } // DummyModule.test145()
                        leave
                    }
                    if lt(sig,0xd9c9ab1f) {
                        if lt(sig,0xd8e2164b) {
                            switch sig
                            case 0xd5c34e4b { result := DummyModule } // DummyModule.test59()
                            case 0xd5e733f7 { result := DummyModule } // DummyModule.test25()
                            case 0xd7d897d5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest53()
                            case 0xd85d1c7e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest18()
                            case 0xd8d20484 { result := AModule } // AModule.setValueViaBModule_cast()
                            leave
                        }
                        switch sig
                        case 0xd8e2164b { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest43()
                        case 0xd906cda0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest6()
                        case 0xd9154bcc { result := AnotherDummyModule } // AnotherDummyModule.atest104()
                        case 0xd9b7849c { result := DummyModule } // DummyModule.test165()
                        case 0xd9c3c16d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest160()
                        leave
                    }
                    switch sig
                    case 0xd9c9ab1f { result := DummyModule } // DummyModule.test113()
                    case 0xda524cf1 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest192()
                    case 0xda67024d { result := AnotherDummyModule } // AnotherDummyModule.atest97()
                    case 0xda7d6767 { result := DummyModule } // DummyModule.test126()
                    case 0xdaa3a163 { result := UpgradeModule } // UpgradeModule.isUpgradeable()
                    case 0xdb24b415 { result := DummyModule } // DummyModule.test42()
                    case 0xdbc9e3c2 { result := AnotherDummyModule } // AnotherDummyModule.atest18()
                    case 0xdc8e4a37 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest11()
                    case 0xdcd4187f { result := AnotherDummyModule } // AnotherDummyModule.atest135()
                    leave
                }
                if lt(sig,0xeecbd32a) {
                    if lt(sig,0xe5cd6262) {
                        if lt(sig,0xe2e8311d) {
                            if lt(sig,0xe0aa4247) {
                                switch sig
                                case 0xdcfe739c { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest111()
                                case 0xde05552d { result := DummyModule } // DummyModule.test182()
                                case 0xdec52acf { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest46()
                                case 0xdf53aa03 { result := DummyModule } // DummyModule.test127()
                                case 0xdf941985 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest132()
                                leave
                            }
                            switch sig
                            case 0xe0aa4247 { result := AnotherDummyModule } // AnotherDummyModule.atest76()
                            case 0xe0c6257e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest66()
                            case 0xe1215f5d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest200()
                            case 0xe2260c3d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest55()
                            case 0xe2dd65dc { result := AnotherDummyModule } // AnotherDummyModule.atest74()
                            leave
                        }
                        switch sig
                        case 0xe2e8311d { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest157()
                        case 0xe2fb18b5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest44()
                        case 0xe30fa944 { result := DummyModule } // DummyModule.test15()
                        case 0xe349f1fd { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest190()
                        case 0xe3807cb8 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest176()
                        case 0xe3c131ce { result := AnotherDummyModule } // AnotherDummyModule.atest37()
                        case 0xe3ce88cc { result := AnotherDummyModule } // AnotherDummyModule.atest9()
                        case 0xe4a3b69c { result := AnotherDummyModule } // AnotherDummyModule.atest187()
                        case 0xe4f58441 { result := DummyModule } // DummyModule.test98()
                        leave
                    }
                    if lt(sig,0xebbf1e95) {
                        if lt(sig,0xe7e56d61) {
                            switch sig
                            case 0xe5cd6262 { result := AnotherDummyModule } // AnotherDummyModule.atest94()
                            case 0xe5d6a77e { result := AnotherDummyModule } // AnotherDummyModule.atest19()
                            case 0xe6eb2e57 { result := AnotherDummyModule } // AnotherDummyModule.atest13()
                            case 0xe75a7473 { result := DummyModule } // DummyModule.test124()
                            case 0xe766ce1b { result := DummyModule } // DummyModule.test181()
                            leave
                        }
                        switch sig
                        case 0xe7e56d61 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest98()
                        case 0xe84d8a9e { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest12()
                        case 0xe923c08c { result := AnotherDummyModule } // AnotherDummyModule.atest133()
                        case 0xe92eabbd { result := AnotherDummyModule } // AnotherDummyModule.atest22()
                        case 0xeaff78d0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest83()
                        leave
                    }
                    switch sig
                    case 0xebbf1e95 { result := AnotherDummyModule } // AnotherDummyModule.atest29()
                    case 0xebcc33d0 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest17()
                    case 0xebf7ff4b { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest114()
                    case 0xec5ce116 { result := AnotherDummyModule } // AnotherDummyModule.atest128()
                    case 0xed6b96aa { result := AnotherDummyModule } // AnotherDummyModule.atest6()
                    case 0xedeb40da { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest104()
                    case 0xee7ba641 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest77()
                    case 0xee89f07c { result := DummyModule } // DummyModule.test20()
                    case 0xee8f4457 { result := AnotherDummyModule } // AnotherDummyModule.atest79()
                    leave
                }
                if lt(sig,0xf8edee55) {
                    if lt(sig,0xf3d9f3d2) {
                        if lt(sig,0xf1d48d0a) {
                            switch sig
                            case 0xeecbd32a { result := DummyModule } // DummyModule.test53()
                            case 0xeeedfc82 { result := AnotherDummyModule } // AnotherDummyModule.atest93()
                            case 0xef363fc4 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest91()
                            case 0xf0f14046 { result := AnotherDummyModule } // AnotherDummyModule.atest71()
                            case 0xf11e4ef4 { result := DummyModule } // DummyModule.test195()
                            leave
                        }
                        switch sig
                        case 0xf1d48d0a { result := DummyModule } // DummyModule.test78()
                        case 0xf1f45b25 { result := DummyModule } // DummyModule.test130()
                        case 0xf21530ed { result := AnotherDummyModule } // AnotherDummyModule.atest35()
                        case 0xf36b9eb3 { result := DummyModule } // DummyModule.test71()
                        case 0xf3c14422 { result := AnotherDummyModule } // AnotherDummyModule.atest170()
                        leave
                    }
                    switch sig
                    case 0xf3d9f3d2 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest79()
                    case 0xf4292b48 { result := DummyModule } // DummyModule.test91()
                    case 0xf48fb5ef { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest15()
                    case 0xf4f779a3 { result := AnotherDummyModule } // AnotherDummyModule.atest138()
                    case 0xf6593b49 { result := AnotherDummyModule } // AnotherDummyModule.atest118()
                    case 0xf778ebdc { result := AnotherDummyModule } // AnotherDummyModule.atest186()
                    case 0xf7aa17aa { result := AnotherDummyModule } // AnotherDummyModule.atest113()
                    case 0xf7b0e37f { result := DummyModule } // DummyModule.test133()
                    case 0xf8336eac { result := AnotherDummyModule } // AnotherDummyModule.atest196()
                    leave
                }
                if lt(sig,0xfcacebe4) {
                    if lt(sig,0xfacdcda8) {
                        switch sig
                        case 0xf8edee55 { result := AnotherDummyModule } // AnotherDummyModule.atest197()
                        case 0xf954b8e2 { result := DummyModule } // DummyModule.test111()
                        case 0xf9fa8cde { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest86()
                        case 0xfa1f6174 { result := AnotherDummyModule } // AnotherDummyModule.atest177()
                        case 0xfa8b8ea1 { result := DummyModule } // DummyModule.test11()
                        leave
                    }
                    switch sig
                    case 0xfacdcda8 { result := DummyModule } // DummyModule.test55()
                    case 0xfb370714 { result := DummyModule } // DummyModule.test129()
                    case 0xfb85396b { result := DummyModule } // DummyModule.test56()
                    case 0xfb8df1f0 { result := DummyModule } // DummyModule.test104()
                    case 0xfc9ad801 { result := DummyModule } // DummyModule.test66()
                    leave
                }
                switch sig
                case 0xfcacebe4 { result := DummyModule } // DummyModule.test143()
                case 0xfd628fd0 { result := AnotherDummyModule } // AnotherDummyModule.atest5()
                case 0xfd6fe6e4 { result := DummyModule } // DummyModule.test140()
                case 0xfde3db83 { result := AnotherDummyModule } // AnotherDummyModule.atest163()
                case 0xfe88b830 { result := AnotherDummyModule } // AnotherDummyModule.atest43()
                case 0xfe89f97f { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest49()
                case 0xfe9090f5 { result := YetAnotherDummyModule } // YetAnotherDummyModule.btest93()
                case 0xfeb53275 { result := DummyModule } // DummyModule.test17()
                case 0xfefc2808 { result := DummyModule } // DummyModule.test150()
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
