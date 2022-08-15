//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract AccountModuleStorage {
    struct AccountModuleStore {
        bool initialized;
        SatelliteFactory.Satellite account;
        mapping(uint256 => AccountRBAC) accountsRBAC;
    }

    struct AccountRBAC {
        address owner;
        mapping(address => SetUtil.Bytes32Set) permissions;
        SetUtil.AddressSet permissionAddresses;
    }

    function _accountModuleStore() internal pure returns (AccountModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.accountmodule")) - 1)
            store.slot := 0xa02d1156ddedf1a9cbc88cd7ce7868a5600323fb301d1e51e70fd83a1b670815
        }
    }
}
