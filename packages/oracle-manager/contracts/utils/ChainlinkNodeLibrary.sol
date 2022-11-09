// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/Node.sol";
import "../interfaces/external/IAggregatorV3Interface.sol";

library ChainlinkNodeLibrary {
    function process(bytes memory parameters) internal view returns (Node.Data memory) {
        IAggregatorV3Interface chainlinkAggr = IAggregatorV3Interface(abi.decode(parameters, (address)));
        (, int256 price, , uint256 updatedAt, ) = chainlinkAggr.latestRoundData();
        return Node.Data(price, updatedAt, 0, 0);
    }
}
