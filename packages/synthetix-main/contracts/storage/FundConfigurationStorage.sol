//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundConfigurationStorage {
    struct FundConfigurationStore {
        uint256 preferredFund;
        uint256[] approvedFunds;
    }

    function _fundConfigurationStore() internal pure returns (FundConfigurationStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundconfiguration")) - 1)
            store.slot := 0xb8adeb43e9d46c86884aee3feb6064c199bae59704ba5a5030f8530e2e23ec5e
        }
    }
}
