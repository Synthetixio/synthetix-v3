// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/NodeFactoryStorage.sol";
import "../interfaces/external/IExternalNode.sol";

library ExternalNodeLibrary {
    function process(NodeFactoryStorage.NodeData[] memory prices, bytes memory parameters)
        internal
        view
        returns (NodeFactoryStorage.NodeData memory)
    {
        IExternalNode externalNode = IExternalNode(abi.decode(parameters, (address)));
        return externalNode.process(prices, parameters);
    }
}
