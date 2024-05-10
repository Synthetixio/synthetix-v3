//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {NodeDefinition} from "@synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {IExternalNode} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {IERC4626} from "./interfaces/IERC4626.sol";

contract ERC4626ToAssetsRatioOracle is IExternalNode {
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;

    address public immutable vaultAddress;
    address public immutable assetAddress;
    uint256 public immutable vaultDecimals;
    uint256 public immutable assetDecimals;

    constructor(address _vaultAddress) {
        vaultAddress = _vaultAddress;
        assetAddress = IERC4626(vaultAddress).asset();
        vaultDecimals = IERC20Metadata(vaultAddress).decimals();
        assetDecimals = IERC20Metadata(assetAddress).decimals();
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory,
        bytes32[] memory
    ) external view returns (NodeOutput.Data memory) {
        uint256 baseUnit = 10 ** vaultDecimals;
        uint256 assetsInVault = IERC4626(vaultAddress).convertToAssets(baseUnit);
        uint256 adjustedRatio;
        
        if (assetDecimals > 18) {
            adjustedRatio = DecimalMath.downscale(assetsInVault, assetDecimals - 18);
        } else if (assetDecimals < 18) {
            adjustedRatio = DecimalMath.upscale(assetsInVault, 18 - assetDecimals);
        } else {
            adjustedRatio = assetsInVault;
        }

        return NodeOutput.Data(adjustedRatio.toInt(), block.timestamp, 0, 0);
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

        IERC4626(vaultAddress).convertToAssets(10 ** vaultDecimals).toInt();

        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
