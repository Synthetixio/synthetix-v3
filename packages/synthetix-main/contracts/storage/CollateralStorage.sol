//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract CollateralStorage {
    struct CollateralStore {
        mapping(address => CollateralData) collateralsData; // CollateralData per collateralType (address)
        SetUtil.AddressSet collaterals; // approved collaterals
    }

    struct CollateralData {
        bool disabled;
        uint targetCRatio;
        uint minimumCRatio;
        address priceFeed;
    }

    function _collateralStore() internal pure returns (CollateralStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.collateral")) - 1)
            store.slot := 0x83916265e1b6c4fb3d473eee2163daacb5963240b78a5853da4fe894b73780a5
        }
    }
}
