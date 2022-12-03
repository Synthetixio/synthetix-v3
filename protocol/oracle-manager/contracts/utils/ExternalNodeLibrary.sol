// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";
import "../interfaces/external/IExternalNode.sol";

library ExternalNodeLibrary {
    function process(
        Node.Data[] memory prices,
        bytes memory parameters
    ) internal view returns (Node.Data memory) {
        IExternalNode externalNode = IExternalNode(abi.decode(parameters, (address)));
        return externalNode.process(prices, parameters);
    }
}
