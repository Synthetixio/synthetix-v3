//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IExternalNode} from "../interfaces/external/IExternalNode.sol";
import {NodeOutput} from "../storage/NodeOutput.sol";
import {NodeDefinition} from "../storage/NodeDefinition.sol";

contract MockPythExternalNode is IExternalNode {
    uint private _price;

    function mockSetCurrentPrice(uint currentPrice) external {
        _price = currentPrice;
    }

    function getCurrentPrice() external view returns (uint) {
        return _price;
    }

    function process(
        NodeOutput.Data[] memory parentNodeOutputs,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view override returns (NodeOutput.Data memory) {
        // solhint-disable-next-line numcast/safe-cast
        return NodeOutput.Data(int(_price), block.timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external override returns (bool) {
        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
