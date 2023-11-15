//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SnapshotVotePowerEpoch} from "./SnapshotVotePowerEpoch.sol";

library SnapshotVotePower {
    struct Data {
        bool enabled;
        mapping(uint128 => SnapshotVotePowerEpoch.Data) epochs;
    }

    function load(address snapshotContract) internal pure returns (Data storage self) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.governance.SnapshotVotePower", snapshotContract)
        );
        assembly {
            self.slot := s
        }
    }
}
