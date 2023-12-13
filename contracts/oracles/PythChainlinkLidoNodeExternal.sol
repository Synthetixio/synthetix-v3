//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {NodeDefinition} from "@synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {IPythChainlinkLidoExternalNode} from "../interfaces/oracles/IPythChainlinkLidoExternalNode.sol";
import {IAggregatorV3Interface} from "../external/IAggregatorV3Interface.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {IWstETH} from "../external/lido/IWstETH.sol";

contract PythChainlinkLidoExternalNode is IPythChainlinkLidoExternalNode {
    function process(
        NodeOutput.Data[] memory prices,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput) {
        return NodeOutput.Data(0, block.timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid) {
        // Must have no parents.
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data.
        if (nodeDefinition.parameters.length != 32 * 4) {
            return false;
        }

        (address pythAddress, bytes32 pythPriceFeedId, address chainlinkAddress, address lidoWstEthAddress) = abi
            .decode(nodeDefinition.parameters, (address, bytes32, address, address));

        // Verify we can get price data from CL.
        IAggregatorV3Interface chainlink = IAggregatorV3Interface(chainlinkAddress);
        chainlink.latestRoundData();

        // Verify we can get price data from Pyth.
        IPyth pyth = IPyth(pythAddress);
        pyth.getEmaPriceUnsafe(pythPriceFeedId);

        // Verify we can get exchange rate from Lido.
        IWstETH(lidoWstEthAddress).getStETHByWstETH(1);

        return true;
    }

    function supportsInterface(bytes4 interfaceID) external view returns (bool) {
        return true;
    }
}
