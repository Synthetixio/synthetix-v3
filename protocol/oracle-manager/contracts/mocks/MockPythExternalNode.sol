//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IExternalNode} from "../interfaces/external/IExternalNode.sol";
import {NodeOutput} from "../storage/NodeOutput.sol";
import {NodeDefinition} from "../storage/NodeDefinition.sol";

contract MockPythExternalNode is IExternalNode {
    uint256 private _price;
    uint256 private _monthlyTolerancePrice;

    uint256 private constant ONE_MONTH = 2592000;

    error OracleDataRequired();

    function mockSetCurrentPrice(uint256 currentPrice) external {
        _price = currentPrice;
    }

    function mockSetMonthlyTolerancePrice(uint256 price) external {
        _monthlyTolerancePrice = price;
    }

    function getCurrentPrice() external view returns (uint256) {
        return _price;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory,
        bytes32[] memory runtimeValues
    ) external view override returns (NodeOutput.Data memory) {
        // Note: when it's 50 seconds, it should revert.  This is a way to test the right
        // tolerance is being sent in during different situations (like liquidations on perps, we should use a strict staleness tolerance)
        if (runtimeValues.length > 0) {
            uint256 strictTolerance = 50;
            if (runtimeValues[0] == bytes32(strictTolerance)) {
                revert OracleDataRequired();
            }

            if (runtimeValues[0] == bytes32(ONE_MONTH)) {
                // solhint-disable-next-line numcast/safe-cast
                return NodeOutput.Data(int(_monthlyTolerancePrice), block.timestamp, 0, 0);
            }
        }
        // solhint-disable-next-line numcast/safe-cast
        return NodeOutput.Data(int(_price), block.timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory) external pure override returns (bool) {
        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
