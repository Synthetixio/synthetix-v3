//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {NodeDefinition} from "@synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IExternalNode} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import {IWstETH} from "../external/lido/IWstETH.sol";

contract LidoStEthPerWstEthRatioNode is IExternalNode {
    using SafeCastU256 for uint256;

    address public immutable lidoWstEthAddress;

    constructor(address _lidoWstEthAddress) {
        lidoWstEthAddress = _lidoWstEthAddress;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory) {
        uint256 amount;
        uint256 i;

        for (i = 0; i < runtimeKeys.length; ) {
            if (runtimeKeys[i] == "amount") {
                // solhint-disable-next-line numcast/safe-cast
                amount = uint256(runtimeValues[i]);
                break;
            }
            unchecked {
                ++i;
            }
        }

        return NodeOutput.Data(IWstETH(lidoWstEthAddress).getStETHByWstETH(amount).toInt(), block.timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid) {
        // Must have no parents.
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data.
        if (nodeDefinition.parameters.length != 32 * 1) {
            return false;
        }

        IWstETH(lidoWstEthAddress).getStETHByWstETH(1);

        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExternalNode).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
