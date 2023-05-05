// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";
import "../interfaces/external/IApi3Proxy.sol";

library Api3Node {
    using DecimalMath for int64;
    using SafeCastI256 for int256;

    int256 public constant PRECISION = 18;

    function process(
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory nodeOutput) {
        address proxy = abi.decode(parameters, (address));
        IApi3Proxy api3Proxy = IApi3Proxy(proxy);
        (int256 price, uint256 timestamp) = api3Proxy.read();

        return NodeOutput.Data(price, timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal view returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 32 * 1) {
            return false;
        }

        address proxy = abi.decode(nodeDefinition.parameters, (address));
        IApi3Proxy api3Proxy = IApi3Proxy(proxy);
        (int256 price, uint256 timestamp) = api3Proxy.read();

        // Must return relevant function without error
        if (timestamp + 1 days < block.timestamp) {
            return false;
        }
        if (price <= 0) {
            return false;
        }
        return true;
    }
}
