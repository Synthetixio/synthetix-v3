//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract NftModuleRouter {
    error UnknownSelector(bytes4 sel);

    address private constant _CORE_MODULE = 0xE5E1f61d38e32a5BD663038bf669fACC66adF715;
    address private constant _NFT_MODULE = 0x3D2717f3c7C2b92c3AD8908bf6AfF5a2DEe6c057;

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
                    if lt(sig,0x2f745c59) {
                        switch sig
                        case 0x01ffc9a7 { result := _NFT_MODULE } // NftModule.supportsInterface()
                        case 0x06fdde03 { result := _NFT_MODULE } // NftModule.name()
                        case 0x081812fc { result := _NFT_MODULE } // NftModule.getApproved()
                        case 0x095ea7b3 { result := _NFT_MODULE } // NftModule.approve()
                        case 0x1627540c { result := _CORE_MODULE } // CoreModule.nominateNewOwner()
                        case 0x18160ddd { result := _NFT_MODULE } // NftModule.totalSupply()
                        case 0x23b872dd { result := _NFT_MODULE } // NftModule.transferFrom()
                        leave
                    }
                    switch sig
                    case 0x2f745c59 { result := _NFT_MODULE } // NftModule.tokenOfOwnerByIndex()
                    case 0x35eb2824 { result := _CORE_MODULE } // CoreModule.isOwnerModuleInitialized()
                    case 0x3659cfe6 { result := _CORE_MODULE } // CoreModule.upgradeTo()
                    case 0x392e53cd { result := _NFT_MODULE } // NftModule.isInitialized()
                    case 0x42842e0e { result := _NFT_MODULE } // NftModule.safeTransferFrom()
                    case 0x4f6ccce7 { result := _NFT_MODULE } // NftModule.tokenByIndex()
                    case 0x53a47bb7 { result := _CORE_MODULE } // CoreModule.nominatedOwner()
                    leave
                }
                if lt(sig,0xa22cb465) {
                    switch sig
                    case 0x624bd96d { result := _CORE_MODULE } // CoreModule.initializeOwnerModule()
                    case 0x6352211e { result := _NFT_MODULE } // NftModule.ownerOf()
                    case 0x70a08231 { result := _NFT_MODULE } // NftModule.balanceOf()
                    case 0x718fe928 { result := _CORE_MODULE } // CoreModule.renounceNomination()
                    case 0x79ba5097 { result := _CORE_MODULE } // CoreModule.acceptOwnership()
                    case 0x8da5cb5b { result := _CORE_MODULE } // CoreModule.owner()
                    case 0x95d89b41 { result := _NFT_MODULE } // NftModule.symbol()
                    leave
                }
                switch sig
                case 0xa22cb465 { result := _NFT_MODULE } // NftModule.setApprovalForAll()
                case 0xa6487c53 { result := _NFT_MODULE } // NftModule.initialize()
                case 0xaaf10f42 { result := _CORE_MODULE } // CoreModule.getImplementation()
                case 0xb88d4fde { result := _NFT_MODULE } // NftModule.safeTransferFrom()
                case 0xc7f62cda { result := _CORE_MODULE } // CoreModule.simulateUpgradeTo()
                case 0xc87b56dd { result := _NFT_MODULE } // NftModule.tokenURI()
                case 0xe985e9c5 { result := _NFT_MODULE } // NftModule.isApprovedForAll()
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
