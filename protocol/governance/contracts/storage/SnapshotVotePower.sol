//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SnapshotVotePowerEpoch.sol";

library SnapshotVotePower {
    struct Data {
				uint128 validFromEpoch;
				uint128 validToEpoch;
				mapping(uint128 => SnapshotVotePowerEpoch.Data) epochs;
    }

    function load(address snapshotContract) internal pure returns (Data storage self) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.SnapshotVotePower", snapshotContract));
        assembly {
            self.slot := s
        }
    }
}
