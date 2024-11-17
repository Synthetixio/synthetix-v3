// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../contracts/ArbGasPriceOracle.sol";

import {Test} from "forge-std/Test.sol";

contract ArbGasPriceOracleTest is Test {
    ArbGasPriceOracle private oracle;

    function setUp() external {
        vm.etch(0x1234123412341234123412341234123412341234, "FORK");
        oracle = new ArbGasPriceOracle(address(0));
    }

    function testIsValidVerifies() external view {
        bytes memory fakeParams = abi.encode(address(0), 0, 0, 0, 0, 0, 0);
        oracle.isValid(
            NodeDefinition.Data(NodeDefinition.NodeType.EXTERNAL, fakeParams, new bytes32[](0))
        );
    }

    function testProcessProcesses() external view {
        bytes memory fakeParams = abi.encode(address(0), 0, 0, 0, 0, 0, 0);
        oracle.process(new NodeOutput.Data[](0), fakeParams, new bytes32[](0), new bytes32[](0));
    }
}
