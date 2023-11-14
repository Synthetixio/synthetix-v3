// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../../storage/NodeDefinition.sol";
import "../../storage/NodeOutput.sol";

library PythOffchainLookupNode {
    using DecimalMath for int64;
    using SafeCastI256 for int256;

    error OracleDataRequired(address oracleContract, bytes oracleQuery);

    int256 public constant PRECISION = 18;

    function process(
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) internal pure returns (NodeOutput.Data memory) {
        (address pythAddress, bytes32 priceId, uint256 stalenessTolerance) = abi.decode(
            parameters,
            (address, bytes32, uint256)
        );

        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "stalenessTolerance") {
                // solhint-disable-next-line numcast/safe-cast
                stalenessTolerance = uint256(runtimeValues[i]);
            }
        }

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceId;

        // In the future Pyth revert data will have the following
        // Query schema:
        //
        // Enum PythQuery {
        //  Latest = 0 {
        //    bytes32[] priceIds,
        //  },
        //  NoOlderThan = 1 {
        //    uint64 stalenessTolerance,
        //    bytes32[] priceIds,
        //  },
        //  Benchmark = 2 {
        //    uint64 publishTime,
        //    bytes32[] priceIds,
        //  }
        // }
        //
        // This contract only implements the PythQuery::NoOlderThan
        revert OracleDataRequired(
            pythAddress,
            abi.encode(
                // solhint-disable-next-line numcast/safe-cast
                uint8(1), // PythQuery::NoOlderThan tag
                // solhint-disable-next-line numcast/safe-cast
                uint64(stalenessTolerance),
                priceIds
            )
        );
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal pure returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 32 * 3) {
            return false;
        }

        abi.decode(nodeDefinition.parameters, (address, bytes32, uint256));

        return true;
    }
}
