// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {
    IExternalNode,
    NodeOutput,
    NodeDefinition
} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import "./interfaces/ArbGasInfo.sol";

contract ArbGasPriceOracle is IExternalNode {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant KIND_SETTLEMENT = 0;
    uint256 public constant KIND_FLAG = 1;
    uint256 public constant KIND_LIQUIDATE = 2;

    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice the ArbGasInfo precompile contract on Arbitrum
    ArbGasInfo public immutable precompile;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

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

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice construct the ArbGasPriceOracle contract
    /// @param _arbGasInfoPrecompileAddress the address of the ArbGasInfo precompile
    constructor(address _arbGasInfoPrecompileAddress) {
        precompile = ArbGasInfo(_arbGasInfoPrecompileAddress);
    }

    /*//////////////////////////////////////////////////////////////
                         EXTERNAL NODE METHODS
    //////////////////////////////////////////////////////////////*/

    function process(
        NodeOutput.Data[] memory,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput) {
        revert("Not implemented");
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid) {
        revert("Not implemented");
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExternalNode).interfaceId || interfaceId == this.supportsInterface.selector;
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL NODE METHODS
    //////////////////////////////////////////////////////////////*/

    function getCostOfExecutionEth(RuntimeParams memory runtimeParams)
        internal
        view
        returns (uint256 costOfExecutionGrossEth)
    {
        (
            uint256 perL2Tx,
            uint256 perL1CalldataByte,
            uint256 perStorageAllocation,
            uint256 perArbGasBase,
            uint256 perArbGasCongestion,
            uint256 perArbGasTotal
        ) = precompile.getPricesInWei();

        uint256 currentTxL1GasFees = precompile.getCurrentTxL1GasFees();

        // Calculate the cost of execution in ETH

        // step 1: fetch & define L2 gas price

        // step 2: fetch & define overhead buffer

        // step 3: fetch & define L1 base fee

        // step 4: fetch & define precision & units information

        // step 5: calculate the cost of execution in ETH
    }

    function getGasUnits(RuntimeParams memory runtimeParams)
        internal
        pure
        returns (uint256 gasUnitsL1, uint256 gasUnitsL2)
    {}
}
