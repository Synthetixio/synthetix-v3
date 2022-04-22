//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract AccountStorage {
    struct AccountStore {
        bool initialized;
        mapping(uint => AccountData) accountsData;
    }

    struct StakedCollateral {
        uint collateralId;
        uint amount;
        uint lockDuration;
        uint startLockingTime;
    }

    // Account finances
    struct AccountData {
        // Id is keccak256(abi.encodePacked(stakedCollateral))
        mapping(uint => bytes32[]) stakedCollateralIds; // staked collateral ids by collateral type
        mapping(bytes32 => StakedCollateral) stakedCollaterals; // staked collateral data by stakedColalteralId
    }

    function _accountStore() internal pure returns (AccountStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.account")) - 1)
            store.slot := 0xc8ca6284657224e913ed6965e10e3e3b51a0642aff2bbaaae02f526ca2fe92c7
        }
    }
}
