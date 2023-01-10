// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeOutput.sol";
import "../interfaces/external/IPyth.sol";

library PythNode {
    function process(bytes memory parameters) internal view returns (NodeOutput.Data memory) {
        (address pythAddress, bytes32 priceFeedId, bool useEma) = abi.decode(
            parameters,
            (address, bytes32, bool)
        );
        IPyth pyth = IPyth(pythAddress);
        PythStructs.Price memory pythData = useEma
            ? pyth.getEmaPriceUnsafe(priceFeedId)
            : pyth.getPriceUnsafe(priceFeedId);
        return NodeOutput.Data(pythData.price, pythData.publishTime, 0, 0);
    }
}
