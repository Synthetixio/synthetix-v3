// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";
import "../interfaces/external/IScryMetaMorph.sol";

library ScryMetaMorphNode {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for int256;

    uint256 public constant PRECISION = 18;

    function process(
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory nodeOutput) {
        (address addrs, uint256 ID) = abi.decode(
            parameters,
            (address, uint256)
        );
        IScryMetaMorph metamorph = IScryMetaMorph(addrs);
        (int256 price, uint256 decimals,,,uint256 timestamp) = metamorph.getFeedPortal(ID);

        price = decimals > PRECISION
            ? price / 10 ** (decimals-PRECISION)
            : price * 10 ** (PRECISION-decimals);

        return NodeOutput.Data(price, timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal view returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 64) {
            return false;
        }

        (address addrs, uint256 ID) = abi.decode(
            nodeDefinition.parameters,
            (address, uint256)
        );
        IScryMetaMorph metamorph = IScryMetaMorph(addrs);
         // Must successfully execute getFeedPortal, the custom portal enforces the users desired quorums among custom oracle sets and data already
        (int256 price, uint256 decimals,,,uint256 timestamp) = metamorph.getFeedPortal(ID);

        return true;
    }
}
