//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundSCCPStorage {
    struct FundSCCPStore {
        uint256 preferredFund;
        uint256[] approvedFunds;
    }

    function _fundSCCPStore() internal pure returns (FundSCCPStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundsccp")) - 1)
            store.slot := 0x90bcb26b14544a1af69f343a9ae77290d18753da0a96856ab710547815970450
        }
    }
}
