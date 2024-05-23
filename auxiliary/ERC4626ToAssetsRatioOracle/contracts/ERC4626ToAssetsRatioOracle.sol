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

    address public immutable VAULT_ADDRESS;
    address public immutable ASSET_ADDRESS;
    uint256 public immutable VAULT_DECIMALS;
    uint256 public immutable ASSET_DECIMALS;
    uint256 public immutable BASE_UNIT;

    constructor(address _vaultAddress) {
        VAULT_ADDRESS = _vaultAddress;
        ASSET_ADDRESS = IERC4626(VAULT_ADDRESS).asset();
        VAULT_DECIMALS = IERC20Metadata(VAULT_ADDRESS).decimals();
        ASSET_DECIMALS = IERC20Metadata(ASSET_ADDRESS).decimals();
        BASE_UNIT = 10 ** VAULT_DECIMALS;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory,
        bytes32[] memory
    ) external view returns (NodeOutput.Data memory) {
        uint256 assetsInVault = IERC4626(VAULT_ADDRESS).convertToAssets(BASE_UNIT);
        uint256 adjustedRatio;

        if (ASSET_DECIMALS > 18) {
            adjustedRatio = DecimalMath.downscale(assetsInVault, ASSET_DECIMALS - 18);
        } else if (ASSET_DECIMALS < 18) {
            adjustedRatio = DecimalMath.upscale(assetsInVault, 18 - ASSET_DECIMALS);
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
        if (nodeDefinition.parameters.length != 32) {
            return false;
        }

        IERC4626(VAULT_ADDRESS).convertToAssets(10 ** VAULT_DECIMALS).toInt();

        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
