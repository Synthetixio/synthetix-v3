//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract AccountStorage {
    struct AccountStore {
        bool initialized;
        mapping(uint => AccountData) accountsData; // AccountData by accountId
    }

    struct StakedCollateral {
        address collateralType; // SNX, LUSD, etc.
        // locking
        uint lockDuration;
        uint lockExpirationTime; // now(staking time) + lockDuration
        // accounting
        uint amount; // adjustable (stake/unstake)
        uint assignedAmount; // adjustable (assign/unassign)
    }

    // Account finances
    struct AccountData {
        // Id is keccak256(abi.encodePacked(stakedCollateral))
        // Collaterals
        SetUtil.Bytes32Set stakedCollateralIds; // staked collateral ids
        mapping(bytes32 => StakedCollateral) stakedCollaterals; // staked collateral data by stakedColalteralId
        // Funds
        SetUtil.AddressSet ownedFunds;
        SetUtil.AddressSet subscribedFunds;
        // Delegations
        mapping(address => bytes32[]) delegations;
        SetUtil.AddressSet delegatedAddresses;
    }

    function _accountStore() internal pure returns (AccountStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.account")) - 1)
            store.slot := 0xc8ca6284657224e913ed6965e10e3e3b51a0642aff2bbaaae02f526ca2fe92c7
        }
    }
}
