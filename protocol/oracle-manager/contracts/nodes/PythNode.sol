// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeOutput.sol";
import "../interfaces/external/IPyth.sol";

library PythNode {
    function process(bytes memory parameters) internal view returns (NodeOutput.Data memory) {
        (IPyth pyth, bytes32 priceFeedId) = abi.decode(parameters, (IPyth, bytes32));
        PythStructs.Price memory pythPrice = pyth.getPrice(priceFeedId);

        return NodeOutput.Data(pythPrice.price, pythPrice.publishTime, 0, 0);
    }
}
