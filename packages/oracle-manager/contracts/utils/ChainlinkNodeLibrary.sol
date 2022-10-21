// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/OracleManagerStorage.sol";
import "../interfaces/external/IAggregatorV3Interface.sol";

library ChainlinkNodeLibrary {
    function process(bytes memory parameters) internal view returns (OracleManagerStorage.NodeData memory) {
        IAggregatorV3Interface chainlinkAggr = IAggregatorV3Interface(abi.decode(parameters, (address)));
        (, int256 price, , uint256 updatedAt, ) = chainlinkAggr.latestRoundData();
        return OracleManagerStorage.NodeData(price, updatedAt, 0, 0);
    }
}
