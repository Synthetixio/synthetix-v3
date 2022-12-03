// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";
import "../interfaces/external/IPyth.sol";

library PythNodeLibrary {
    function process(bytes memory parameters) internal view returns (Node.Data memory) {
        (IPyth pyth, bytes32 priceFeedId) = abi.decode(parameters, (IPyth, bytes32));
        PythStructs.Price memory pythPrice = pyth.getPrice(priceFeedId);

        // TODO: use confidence score to determine volatility and liquidity scores
        return Node.Data(pythPrice.price, pythPrice.publishTime, 0, 0);
    }
}
