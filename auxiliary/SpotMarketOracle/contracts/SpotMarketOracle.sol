// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IExternalNode, NodeOutput, NodeDefinition} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import {ISpotMarketSystem} from "./interfaces/ISpotMarketSystem.sol";
import {Price} from "@synthetixio/spot-market/contracts/storage/Price.sol";

contract SpotMarketOracle is IExternalNode {
    using DecimalMath for int256;
    using DecimalMath for uint256;

    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    int256 public constant PRECISION = 18;

    address public immutable spotMarketAddress;

    constructor(address _spotMarketAddress) {
        spotMarketAddress = _spotMarketAddress;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput) {
        (, uint128 marketId) = abi.decode(parameters, (address, uint128));

        uint256 synthAmount;
        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "size") {
                // solhint-disable-next-line numcast/safe-cast
                synthAmount = uint256(runtimeValues[i]);
                break;
            }
        }

        if (synthAmount == 0) {
            // solhint-disable-next-line numcast/safe-cast
            return NodeOutput.Data(int256(0), block.timestamp, 0, 0);
        }

        (uint256 synthValue, ) = ISpotMarketSystem(spotMarketAddress).quoteSellExactIn(
            marketId,
            synthAmount,
            Price.Tolerance.DEFAULT
        );

        // solhint-disable-next-line numcast/safe-cast
        return NodeOutput.Data(int256(synthValue.divDecimal(synthAmount)), block.timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        (, uint128 marketId) = abi.decode(nodeDefinition.parameters, (address, uint128));

        address synthAddress = ISpotMarketSystem(spotMarketAddress).getSynth(marketId);

        //check if the market is registered
        if (synthAddress == address(0)) {
            return false;
        }

        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
