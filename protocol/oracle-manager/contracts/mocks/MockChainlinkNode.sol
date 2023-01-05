// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../nodes/ChainlinkNode.sol";

contract MockChainlinkNode {
    function process(bytes memory parameters) external view returns (NodeOutput.Data memory) {
        return ChainlinkNode.process(parameters);
    }
}
