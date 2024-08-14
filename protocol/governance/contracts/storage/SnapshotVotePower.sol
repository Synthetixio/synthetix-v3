//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MathUtil} from "../utils/MathUtil.sol";
import {SnapshotVotePowerEpoch} from "./SnapshotVotePowerEpoch.sol";

library SnapshotVotePower {
    error InvalidWeightType();

    enum WeightType {
        Sqrt,
        Linear,
        Scaled
    }

    struct Data {
        bool enabled;
        SnapshotVotePower.WeightType weight;
        uint256 scale; // 18 decimals
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

    function calculateVotingPower(
        SnapshotVotePower.Data storage self,
        uint256 ballotBalance
    ) internal view returns (uint256 votePower) {
        if (self.weight == WeightType.Sqrt) {
            return MathUtil.sqrt(ballotBalance);
        }

        if (self.weight == WeightType.Linear) {
            return ballotBalance;
        }

        if (self.weight == WeightType.Scaled) {
            // solhint-disable-next-line
            return (ballotBalance * self.scale) / 10 ** 18;
        }

        revert InvalidWeightType();
    }
}
