// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IExternalNode, NodeOutput, NodeDefinition} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import {ArbGasInfo} from "./interfaces/ArbGasInfo.sol";

contract ArbGasPriceOracle is IExternalNode {
    using SafeCastU256 for uint256;

    /**
     * @notice identifies resources consumed via async order settlement
     */
    uint256 public constant KIND_SETTLEMENT = 0;

    /**
     * @notice identifies resources consumed via account flagged for liquidation
     */
    uint256 public constant KIND_FLAG = 1;

    /**
     * @notice identifies resources consumed via account liquidation
     */
    uint256 public constant KIND_LIQUIDATE = 2;

    /**
     * @notice the ArbGasInfo precompile contract on Arbitrum
     */
    ArbGasInfo public immutable PRECOMPILE;

    /**
     * @notice runtime parameters for the cost of resources consumed
     * during execution on L1 and L2
     */
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

    /**
     * @notice thrown when the execution kind is invalid
     */
    error ArbGasPriceOracleInvalidExecutionKind();

    /**
     * @notice construct the ArbGasPriceOracle contract
     * @param _arbGasInfoPrecompileAddress the address of the ArbGasInfo precompile
     */
    constructor(address _arbGasInfoPrecompileAddress) {
        PRECOMPILE = ArbGasInfo(_arbGasInfoPrecompileAddress);
    }

    /**
     * @notice process the cost of execution in ETH
     * @param parameters the parameters for the cost of execution calculation
     * @param runtimeKeys the runtime keys for the cost of execution calculation
     * @param runtimeValues the runtime values for the cost of execution calculation
     * @return nodeOutput the cost of execution in ETH and timestamp
     * when the cost was calculated (other fields are not used in this implementation)
     */
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

    /**
     * @notice verify the validity of the external node and its functionality
     * @param nodeDefinition the node definition to verify
     * @return valid true if the external node is valid, false otherwise
     */
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

        // verify the oracle can be properly called
        try PRECOMPILE.getPricesInWei() {
            // do nothing
        } catch {
            return false;
        }
        try PRECOMPILE.getL1BaseFeeEstimate() {
            // do nothing
        } catch {
            return false;
        }

        return true;
    }

    /**
     * @notice check if the contract supports the given interface
     * @param interfaceId the interface ID to check
     * @return true if the contract supports the given interface, false otherwise
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExternalNode).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }

    /**
     * @notice calculate and return the cost of execution in ETH
     * @dev gas costs are 2-dimensional: L1 and L2 resources
     *      - L1 resources include calldata
     *      - L2 resources include computation
     * @dev total fee charged to a transaction is the L2 basefee,
     * multiplied by the sum of the L2 gas used plus the L1 calldata charge
     * @param runtimeParams the runtime parameters for the cost of execution calculation
     * @return costOfExecutionGrossEth the cost of execution in ETH
     */
    function getCostOfExecutionEth(
        RuntimeParams memory runtimeParams
    ) internal view returns (uint256 costOfExecutionGrossEth) {
        // fetch & define L2 gas price
        /// @dev perArbGasTotal is the best estimate of the L2 gas price "base fee" in wei
        (, , , , , uint256 perArbGasTotal) = PRECOMPILE.getPricesInWei();

        // fetch & define L1 gas base fee; incorporate overhead buffer
        /// @dev if the estimate is too low or high at the time of the L1 batch submission,
        /// the transaction will still be processed, but the arbitrum nitro mechanism will
        /// amortize the deficit/surplus over subsequent users of the chain
        /// (i.e. lowering/raising the L1 base fee for a period of time)
        uint256 l1BaseFee = PRECOMPILE.getL1BaseFeeEstimate();

        // fetch & define gas units consumed on L1 and L2 for the given execution kind
        (uint256 gasUnitsL1, uint256 gasUnitsL2) = getGasUnits(runtimeParams);

        // (1) calculate total fee:
        //   -> total_fee = P * G
        // where:
        // (2) P is the L2 basefee
        //   -> P = L2 basefee
        // (3) G is gas limit that also accounts for L1 dimension
        //   -> G = L2 gas used + ( L1 calldata price * L1 calldata size) / (L2 gas price)
        costOfExecutionGrossEth =
            perArbGasTotal *
            (gasUnitsL2 + ((l1BaseFee * gasUnitsL1) / perArbGasTotal));
    }

    /**
     * @notice get the gas units consumed on L1 and L2 for the given execution kind
     * @param runtimeParams the runtime parameters for the cost of execution calculation
     * @return gasUnitsL1 the gas units consumed on L1
     * @return gasUnitsL2 the gas units consumed on L2
     */
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
            revert ArbGasPriceOracleInvalidExecutionKind();
        }
    }
}
