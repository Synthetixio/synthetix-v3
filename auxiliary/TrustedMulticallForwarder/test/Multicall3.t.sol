// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    ERC2771Forwarder,
    Address
} from "../lib/openzeppelin-contracts/contracts/metatx/ERC2771Forwarder.sol";
import {TrustedMulticallForwarder} from "../src/TrustedMulticallForwarder.sol";
import {MockCallee} from "./mocks/MockCallee.sol";
import {EtherSink} from "./mocks/EtherSink.sol";

contract TrustedMulticallForwarderTest is Test {
    TrustedMulticallForwarder multicall;
    MockCallee callee;
    EtherSink etherSink;

    /// @notice Setups up the testing suite
    function setUp() public {
        multicall = new TrustedMulticallForwarder();
        callee = new MockCallee();
        etherSink = new EtherSink();
    }

    /// >>>>>>>>>>>>>>>>>>>>>  AGGREGATE TESTS  <<<<<<<<<<<<<<<<<<<<< ///

    function testAggregation() public {
        // Test successful call
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](1);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        (uint256 blockNumber, bytes[] memory returnData) =
            multicall.aggregate(calls);
        assertEq(blockNumber, block.number);
        assertEq(
            keccak256(returnData[0]),
            keccak256(abi.encodePacked(blockhash(block.number)))
        );
    }

    function testUnsuccessfulAggregation() public {
        // Test unexpected revert
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](2);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call(
            address(callee), abi.encodeWithSignature("thisMethodReverts()")
        );
        vm.expectRevert(bytes(hex"81775cc3"));
        multicall.aggregate(calls);
    }

    /// >>>>>>>>>>>>>>>>>>>  TRY AGGREGATE TESTS  <<<<<<<<<<<<<<<<<<< ///

    function testTryAggregate() public {
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](2);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call(
            address(callee), abi.encodeWithSignature("thisMethodReverts()")
        );
        (TrustedMulticallForwarder.Result[] memory returnData) =
            multicall.tryAggregate(false, calls);
        assertTrue(returnData[0].success);
        assertEq(
            keccak256(returnData[0].returnData),
            keccak256(abi.encodePacked(blockhash(block.number)))
        );
        assertTrue(!returnData[1].success);
    }

    function testTryAggregateUnsuccessful() public {
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](2);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call(
            address(callee), abi.encodeWithSignature("thisMethodReverts()")
        );
        vm.expectRevert(bytes(hex"81775cc3"));
        multicall.tryAggregate(true, calls);
    }

    /// >>>>>>>>>>>>>>  TRY BLOCK AND AGGREGATE TESTS  <<<<<<<<<<<<<< ///

    function testTryBlockAndAggregate() public {
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](2);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call(
            address(callee), abi.encodeWithSignature("thisMethodReverts()")
        );
        (
            uint256 blockNumber,
            bytes32 blockHash,
            TrustedMulticallForwarder.Result[] memory returnData
        ) = multicall.tryBlockAndAggregate(false, calls);
        assertEq(blockNumber, block.number);
        assertEq(blockHash, blockhash(block.number));
        assertTrue(returnData[0].success);
        assertEq(
            keccak256(returnData[0].returnData),
            keccak256(abi.encodePacked(blockhash(block.number)))
        );
        assertTrue(!returnData[1].success);
    }

    function testTryBlockAndAggregateUnsuccessful() public {
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](2);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call(
            address(callee), abi.encodeWithSignature("thisMethodReverts()")
        );
        vm.expectRevert(bytes(hex"81775cc3"));
        multicall.tryBlockAndAggregate(true, calls);
    }

    function testBlockAndAggregateUnsuccessful() public {
        TrustedMulticallForwarder.Call[] memory calls =
            new TrustedMulticallForwarder.Call[](2);
        calls[0] = TrustedMulticallForwarder.Call(
            address(callee),
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call(
            address(callee), abi.encodeWithSignature("thisMethodReverts()")
        );
        vm.expectRevert(bytes(hex"81775cc3"));
        multicall.blockAndAggregate(calls);
    }

    /// >>>>>>>>>>>>>>>>>>>  AGGREGATE3 TESTS  <<<<<<<<<<<<<<<<<<<<<< ///

    function testAggregate3() public {
        TrustedMulticallForwarder.Call3[] memory calls =
            new TrustedMulticallForwarder.Call3[](3);
        calls[0] = TrustedMulticallForwarder.Call3(
            address(callee),
            true,
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call3(
            address(callee),
            false,
            abi.encodeWithSignature("thisMethodReverts()")
        );
        calls[2] = TrustedMulticallForwarder.Call3(
            address(multicall),
            false,
            abi.encodeWithSignature("getCurrentBlockTimestamp()")
        );
        (TrustedMulticallForwarder.Result[] memory returnData) =
            multicall.aggregate3(calls);

        // Call 1.
        assertTrue(returnData[0].success);
        assertEq(
            blockhash(block.number),
            abi.decode(returnData[0].returnData, (bytes32))
        );
        assertEq(
            keccak256(returnData[0].returnData),
            keccak256(abi.encodePacked(blockhash(block.number)))
        );

        // Call 2.
        assertTrue(!returnData[1].success);
        assertEq(returnData[1].returnData.length, 4);
        assertEq(
            bytes4(returnData[1].returnData),
            bytes4(keccak256("Unsuccessful()"))
        );

        // Call 3.
        assertTrue(returnData[2].success);
        assertEq(
            abi.decode(returnData[2].returnData, (uint256)), block.timestamp
        );
    }

    function testAggregate3Unsuccessful() public {
        TrustedMulticallForwarder.Call3[] memory calls =
            new TrustedMulticallForwarder.Call3[](2);
        calls[0] = TrustedMulticallForwarder.Call3(
            address(callee),
            true,
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call3(
            address(callee),
            true,
            abi.encodeWithSignature("thisMethodReverts()")
        );
        vm.expectRevert(bytes(hex"81775cc3"));
        multicall.aggregate3(calls);
    }

    /// >>>>>>>>>>>>>>>>>  AGGREGATE3VALUE TESTS  <<<<<<<<<<<<<<<<<<< ///

    function testAggregate3Value() public {
        TrustedMulticallForwarder.Call3Value[] memory calls =
            new TrustedMulticallForwarder.Call3Value[](3);
        calls[0] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            true,
            0,
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            false,
            0,
            abi.encodeWithSignature("thisMethodReverts()")
        );
        calls[2] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            false,
            1,
            abi.encodeWithSignature(
                "sendBackValue(address)", address(etherSink)
            )
        );
        (TrustedMulticallForwarder.Result[] memory returnData) =
            multicall.aggregate3Value{value: 1}(calls);
        assertTrue(returnData[0].success);
        assertEq(
            keccak256(returnData[0].returnData),
            keccak256(abi.encodePacked(blockhash(block.number)))
        );
        assertTrue(!returnData[1].success);
        assertTrue(returnData[2].success);
    }

    function testAggregate3ValueUnsuccessful() public {
        TrustedMulticallForwarder.Call3Value[] memory calls =
            new TrustedMulticallForwarder.Call3Value[](3);
        calls[0] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            true,
            0,
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls[1] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            true,
            0,
            abi.encodeWithSignature("thisMethodReverts()")
        );
        calls[2] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            true,
            1,
            abi.encodeWithSignature(
                "sendBackValue(address)", address(etherSink)
            )
        );
        vm.expectRevert(bytes(hex"81775cc3"));
        multicall.aggregate3Value{value: 1}(calls);

        // Should fail if we don't provide enough value
        TrustedMulticallForwarder.Call3Value[] memory calls2 =
            new TrustedMulticallForwarder.Call3Value[](1);
        calls2[0] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            false,
            1,
            abi.encodeWithSignature(
                "sendBackValue(address)", address(etherSink)
            )
        );
        // trying to figure out how to check the actual error here but its hard
        //vm.expectRevert(ERC2771Forwarder.ERC2771ForwarderMismatchedValue.selector);
        vm.expectRevert();
        multicall.aggregate3Value(calls2);

        // Works if we provide enough value
        TrustedMulticallForwarder.Call3Value[] memory calls3 =
            new TrustedMulticallForwarder.Call3Value[](3);
        calls3[0] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            true,
            0,
            abi.encodeWithSignature("getBlockHash(uint256)", block.number)
        );
        calls3[1] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            false,
            0,
            abi.encodeWithSignature("thisMethodReverts()")
        );
        calls3[2] = TrustedMulticallForwarder.Call3Value(
            address(callee),
            true,
            1,
            abi.encodeWithSignature(
                "sendBackValue(address)", address(etherSink)
            )
        );
        multicall.aggregate3Value{value: 1}(calls3);
    }

    /// >>>>>>>>>>>>>>>>>>>>>>  HELPER TESTS  <<<<<<<<<<<<<<<<<<<<<<< ///

    function testGetBlockHash(uint256 blockNumber) public {
        assertEq(blockhash(blockNumber), multicall.getBlockHash(blockNumber));
    }

    function testGetBlockNumber() public {
        assertEq(block.number, multicall.getBlockNumber());
    }

    function testGetCurrentBlockCoinbase() public {
        assertEq(block.coinbase, multicall.getCurrentBlockCoinbase());
    }

    function testGetCurrentBlockGasLimit() public {
        assertEq(block.gaslimit, multicall.getCurrentBlockGasLimit());
    }

    function testGetCurrentBlockTimestamp() public {
        assertEq(block.timestamp, multicall.getCurrentBlockTimestamp());
    }

    function testGetEthBalance(address addr) public {
        assertEq(addr.balance, multicall.getEthBalance(addr));
    }

    function testGetLastBlockHash() public {
        // Prevent arithmetic underflow on the genesis block
        if (block.number == 0) return;
        assertEq(blockhash(block.number - 1), multicall.getLastBlockHash());
    }

    function testGetBasefee() public {
        assertEq(block.basefee, multicall.getBasefee());
    }

    function testGetChainId() public {
        assertEq(block.chainid, multicall.getChainId());
    }
}
