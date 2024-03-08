// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IExternalNode, NodeOutput, NodeDefinition} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import "./interfaces/IOVM_GasPriceOracle.sol";

contract OpGasPriceOracle is IExternalNode {
    using SafeCastU256 for uint256;

    address public immutable ovmGasPriceOracleAddress;

    uint256 public constant KIND_SETTLEMENT = 0;
    uint256 public constant KIND_FLAG = 1;
    uint256 public constant KIND_LIQUIDATE = 2;
    struct RuntimeParams {
        // Order execution
        uint256 l1SettleGasUnits;
        uint256 l2SettleGasUnits;
        // Flag
        uint256 l1FlagGasUnits;
        uint256 l2FlagGasUnits;
        // Liquidate (Rate limited)
        uint256 l1LiquidateGasUnits;
        uint256 l2LiquidateGasUnits;
        // Call params
        uint256 numberOfUpdatedFeeds;
        uint256 executionKind;
    }

    constructor(address _ovmGasPriceOracleAddress) {
        // Addresses configuration
        ovmGasPriceOracleAddress = _ovmGasPriceOracleAddress;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput) {
        RuntimeParams memory runtimeParams;
        (
            ,
            runtimeParams.l1SettleGasUnits,
            runtimeParams.l2SettleGasUnits,
            runtimeParams.l1FlagGasUnits,
            runtimeParams.l2FlagGasUnits,
            runtimeParams.l1LiquidateGasUnits,
            runtimeParams.l2LiquidateGasUnits
        ) = abi.decode(parameters, (address, uint256, uint256, uint256, uint256, uint256, uint256));

        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "executionKind") {
                // solhint-disable-next-line numcast/safe-cast
                runtimeParams.executionKind = uint256(runtimeValues[i]);
                continue;
            }
            if (runtimeKeys[i] == "numberOfUpdatedFeeds") {
                // solhint-disable-next-line numcast/safe-cast
                runtimeParams.numberOfUpdatedFeeds = uint256(runtimeValues[i]);
                continue;
            }
        }

        uint256 costOfExecutionEth = getCostOfExecutionEth(runtimeParams);

        return NodeOutput.Data(costOfExecutionEth.toInt(), block.timestamp, 0, 0);
    }

    function getCostOfExecutionEth(
        RuntimeParams memory runtimeParams
    ) internal view returns (uint256 costOfExecutionGrossEth) {
        IOVM_GasPriceOracle ovmGasPriceOracle = IOVM_GasPriceOracle(ovmGasPriceOracleAddress);
        bool isEcotone;
        try ovmGasPriceOracle.isEcotone() returns (bool _isEcotone) {
            isEcotone = _isEcotone;
        } catch {
            // If the call fails, we assume it's not an ecotone. Explicitly setting it to false to avoid missunderstandings
            isEcotone = false;
        }

        if (isEcotone) {
            // If it's an ecotone, use the new formula and interface
            uint256 gasPriceL2 = ovmGasPriceOracle.baseFee();
            uint256 baseFeeScalar = ovmGasPriceOracle.baseFeeScalar();
            uint256 l1BaseFee = ovmGasPriceOracle.l1BaseFee();
            uint256 blobBaseFeeScalar = ovmGasPriceOracle.blobBaseFeeScalar();
            uint256 blobBaseFee = ovmGasPriceOracle.blobBaseFee();
            uint256 decimals = ovmGasPriceOracle.decimals();

            (uint256 gasUnitsL1, uint256 gasUnitsL2) = getGasUnits(runtimeParams);

            uint256 l1GasPrice = (baseFeeScalar *
                l1BaseFee *
                16 +
                blobBaseFeeScalar *
                blobBaseFee) / (16 * 10 ** decimals);

            costOfExecutionGrossEth = ((gasUnitsL1 * l1GasPrice) + (gasUnitsL2 * gasPriceL2));
        } else {
            // If it's not an ecotone, use the legacy formula and interface
            uint256 gasPriceL2 = ovmGasPriceOracle.baseFee(); // baseFee and gasPrice are the same in the legacy contract. Both return block.basefee
            uint256 overhead = ovmGasPriceOracle.overhead();
            uint256 l1BaseFee = ovmGasPriceOracle.l1BaseFee();
            uint256 decimals = ovmGasPriceOracle.decimals();
            uint256 scalar = ovmGasPriceOracle.scalar();

            (uint256 gasUnitsL1, uint256 gasUnitsL2) = getGasUnits(runtimeParams);

            costOfExecutionGrossEth = ((((gasUnitsL1 + overhead) * l1BaseFee * scalar) /
                10 ** decimals) + (gasUnitsL2 * gasPriceL2));
        }
    }

    function getGasUnits(
        RuntimeParams memory runtimeParams
    ) internal pure returns (uint256 gasUnitsL1, uint256 gasUnitsL2) {
        if (runtimeParams.executionKind == KIND_SETTLEMENT) {
            gasUnitsL1 = runtimeParams.l1SettleGasUnits;
            gasUnitsL2 = runtimeParams.l2SettleGasUnits;
        } else if (runtimeParams.executionKind == KIND_FLAG) {
            // Flag gas units
            gasUnitsL1 = runtimeParams.numberOfUpdatedFeeds * runtimeParams.l1FlagGasUnits;
            gasUnitsL2 = runtimeParams.numberOfUpdatedFeeds * runtimeParams.l2FlagGasUnits;
        } else if (runtimeParams.executionKind == KIND_LIQUIDATE) {
            // Iterations is fixed to 1 for liquidations
            gasUnitsL1 = runtimeParams.l1LiquidateGasUnits;
            gasUnitsL2 = runtimeParams.l2LiquidateGasUnits;
        } else {
            revert("Invalid execution kind");
        }
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // must be able to decode parameters
        RuntimeParams memory runtimeParams;
        (
            ,
            runtimeParams.l1SettleGasUnits,
            runtimeParams.l2SettleGasUnits,
            runtimeParams.l1FlagGasUnits,
            runtimeParams.l2FlagGasUnits,
            runtimeParams.l1LiquidateGasUnits,
            runtimeParams.l2LiquidateGasUnits
        ) = abi.decode(
            nodeDefinition.parameters,
            (address, uint256, uint256, uint256, uint256, uint256, uint256)
        );

        // Must be able to call the oracle
        IOVM_GasPriceOracle ovmGasPriceOracle = IOVM_GasPriceOracle(ovmGasPriceOracleAddress);

        ovmGasPriceOracle.gasPrice();
        ovmGasPriceOracle.l1BaseFee();
        ovmGasPriceOracle.decimals();

        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
