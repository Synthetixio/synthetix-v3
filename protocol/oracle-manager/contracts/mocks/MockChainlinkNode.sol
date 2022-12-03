// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../utils/ChainlinkNodeLibrary.sol";

contract MockChainlinkNode {
    function process(bytes memory parameters) external view returns (Node.Data memory) {
        return ChainlinkNodeLibrary.process(parameters);
    }
}
