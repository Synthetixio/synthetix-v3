//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MathUtil} from "../utils/MathUtil.sol";
import {SnapshotVotePowerEpoch} from "./SnapshotVotePowerEpoch.sol";

library SnapshotVotePower {
    error InvalidWeightType();

    enum WeightType {
        Sqrt,
        Linear
    }

    struct Data {
        bool enabled;
        SnapshotVotePower.WeightType weight;
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

    function calculateVotePower(
        SnapshotVotePower.WeightType weight,
        uint256 ballotBalance
    ) internal pure returns (uint256 votePower) {
        if (weight == WeightType.Sqrt) {
            return MathUtil.sqrt(ballotBalance);
        }

        if (weight == WeightType.Linear) {
            return ballotBalance;
        }

        revert InvalidWeightType();
    }
}
