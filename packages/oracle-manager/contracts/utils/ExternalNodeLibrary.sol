// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/OracleManagerStorage.sol";
import "../interfaces/external/IExternalNode.sol";

library ExternalNodeLibrary {
    function process(OracleManagerStorage.NodeData[] memory prices, bytes memory parameters)
        internal
        returns (OracleManagerStorage.NodeData memory)
    {
        IExternalNode externalNode = IExternalNode(abi.decode(parameters, (address)));
        return externalNode.process(prices, parameters);
    }
}
