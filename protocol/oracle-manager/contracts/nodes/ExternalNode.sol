// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeOutput.sol";
import "../interfaces/external/IExternalNode.sol";

library ExternalNode {
    function process(
        NodeOutput.Data[] memory prices,
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory) {
        IExternalNode externalNode = IExternalNode(abi.decode(parameters, (address)));
        return externalNode.process(prices, parameters);
    }
}
