// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";
import "../interfaces/external/IPyth.sol";

library PythNode {
    function process(bytes memory parameters) internal view returns (NodeOutput.Data memory) {
        (address pythAddress, bytes32 priceFeedId, bool useEma) = abi.decode(
            parameters,
            (address, bytes32, bool)
        );
        IPyth pyth = IPyth(pythAddress);
        PythStructs.Price memory pythData = useEma
            ? pyth.getEmaPriceUnsafe(priceFeedId)
            : pyth.getPriceUnsafe(priceFeedId);
        return NodeOutput.Data(pythData.price, pythData.publishTime, 0, 0);
    }

    function validate(NodeDefinition.Data memory nodeDefinition) internal view returns (bool) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 32 * 3) {
            return false;
        }

        (address pythAddress, bytes32 priceFeedId, bool useEma) = abi.decode(
            nodeDefinition.parameters,
            (address, bytes32, bool)
        );
        IPyth pyth = IPyth(pythAddress);

        // Must return relevant function without error
        useEma ? pyth.getEmaPriceUnsafe(priceFeedId) : pyth.getPriceUnsafe(priceFeedId);

        return true;
    }
}
