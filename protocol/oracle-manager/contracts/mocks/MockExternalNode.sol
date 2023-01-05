// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../interfaces/external/IExternalNode.sol";

contract MockExternalNode is IExternalNode {
    NodeOutput.Data output;

    constructor(NodeOutput.Data memory _output) {
        output = _output;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory
    ) external view override returns (NodeOutput.Data memory) {
        return output;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
