//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract CollateralStorage {
    struct CollateralStore {
        mapping(address => CollateralData) collateralsData; // CollateralData per collateralType (address)
        SetUtil.AddressSet collaterals; // approved collaterals
        // Staked Collaterals
        mapping(uint => SetUtil.AddressSet) stakedCollateralsByAccountId;
        mapping(uint => mapping(address => StakedCollateralData)) stakedCollateralsDataByAccountId;
    }

    struct CollateralData {
        bool disabled;
        uint targetCRatio;
        uint minimumCRatio;
        address priceFeed;
    }

    struct StakedCollateralData {
        bool isSet;
        uint256 amount; // adjustable (stake/unstake)
        uint256 assignedAmount; // adjustable (assign/unassign)
        StakedCollateralLock[] locks;
    }

    struct StakedCollateralLock {
        uint256 amount; // adjustable (stake/unstake)
        uint64 lockExpirationTime; // adjustable (assign/unassign)
    }

    function _collateralStore() internal pure returns (CollateralStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.collateral")) - 1)
            store.slot := 0x83916265e1b6c4fb3d473eee2163daacb5963240b78a5853da4fe894b73780a5
        }
    }
}
