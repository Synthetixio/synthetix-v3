//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract AccountTokenStorage {
    struct AccountStore {
        bool initialized;
        mapping(uint256 => AccountData) accountsData; // AccountData by accountId
        mapping(address => CollateralData) collateralsData; // CollateralData per collateralType (address)
        SetUtil.AddressSet collaterals; // approved collaterals
    }

    struct CollateralData {
        bool disabled;
        uint targetCRatio;
        uint minimumCRatio;
        address priceFeed;
    }

    struct StakedCollateralData {
        bool set;
        uint256 amount; // adjustable (stake/unstake)
        uint256 assignedAmount; // adjustable (assign/unassign)
        StakedCollateralLock[] locks;
    }

    struct StakedCollateralLock {
        uint256 amount; // adjustable (stake/unstake)
        uint64 lockExpirationTime; // adjustable (assign/unassign)
    }

    struct AccountData {
        // Permissions
        mapping(address => SetUtil.Bytes32Set) permissions;
        SetUtil.AddressSet permissionAddresses;
        // Collaterals
        mapping(address => StakedCollateralData) stakedCollateralsData;
        // Funds
        uint256[] subscribedFunds;
    }

    function _accountStore() internal pure returns (AccountStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.account")) - 1)
            store.slot := 0xc8ca6284657224e913ed6965e10e3e3b51a0642aff2bbaaae02f526ca2fe92c7
        }
    }
}
