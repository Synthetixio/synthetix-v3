// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../contracts/PythERC7412Wrapper.sol";

import {Test} from "forge-std/Test.sol";

contract MockPythApi {
    uint256[] public updateDatas;
    function updatePriceFeeds(bytes[] memory updateData) external payable {
        for (uint256 i = 0; i < updateData.length; i++) {
            updateDatas.push(abi.decode(updateData[i], (uint256)));
        }
    }
    function getPriceUnsafe(bytes32) external pure returns (PythStructs.Price memory price) {
        return PythStructs.Price(100, 0, -17, 0);
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata /*priceIds*/,
        uint64 /*minPublishTime*/,
        uint64 /*maxPublishTime*/
    ) external payable returns (PythStructs.PriceFeed[] memory /*priceFeeds*/) {
        for (uint256 i = 0; i < updateData.length; i++) {
            updateDatas.push(abi.decode(updateData[i], (uint256)));
        }
    }

    function reset() external {
        while (updateDatas.length > 0) {
            updateDatas.pop();
        }
    }
}

contract PythERC7412WrapperTest is Test {
    MockPythApi mockPyth;
    PythERC7412Wrapper wrapper;
    bytes32 testFeedId = keccak256("test");

    function setUp() external {
        vm.etch(0x1234123412341234123412341234123412341234, "FORK");
        mockPyth = new MockPythApi();
        wrapper = new PythERC7412Wrapper(address(mockPyth));
    }

    function testSetLatestPriceOutsideOfForkFails() external {
        vm.etch(0x1234123412341234123412341234123412341234, "notf");

        vm.expectRevert(ForkDetector.OnlyOnDevFork.selector);
        wrapper.setLatestPrice(testFeedId, 500);
    }

    function testSetLatestPrice() external {
        wrapper.setLatestPrice(testFeedId, 500);

        assertEq(wrapper.getLatestPrice(testFeedId, 0), 500);
    }

    function testGetLatestPrice() external view {
        assertEq(wrapper.getLatestPrice(testFeedId, 0), 1000);
    }

    function testSetBenchmarkPriceOutsideOfForkFails() external {
        vm.etch(0x1234123412341234123412341234123412341234, "notf");

        vm.expectRevert(ForkDetector.OnlyOnDevFork.selector);
        wrapper.setLatestPrice(testFeedId, 500);
    }

    function testSetBenchmarkPrice() external {
        wrapper.setBenchmarkPrice(testFeedId, 100, 1234, -18);

        assertEq(wrapper.getBenchmarkPrice(testFeedId, 100), 1234);
    }

    function testGetBenchmarkPriceWithSkip() external {
        wrapper.setBenchmarkPrice(testFeedId, 100, -1, -18);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC7412.OracleDataRequired.selector,
                address(wrapper),
                hex"000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000649c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658"
            )
        );
        wrapper.getBenchmarkPrice(testFeedId, 100);
    }

    function testFulfillLatest() external {
        bytes[] memory updates = new bytes[](2);
        updates[0] = abi.encode(100);
        updates[1] = abi.encode(200);
        wrapper.fulfillOracleQuery(abi.encode(1, 1, new bytes32[](0), updates));
        assertEq(mockPyth.updateDatas(0), 100);
        assertEq(mockPyth.updateDatas(1), 200);
        //assertEq(mockPyth.updateDatas(2), 0);
        mockPyth.reset();
    }

    function testFulfillBenchmark() external {
        bytes[] memory updates = new bytes[](2);
        updates[0] = abi.encode(100);
        updates[1] = abi.encode(200);
        bytes32[] memory updateIds = new bytes32[](2);
        updateIds[0] = "abc";
        updateIds[1] = "def";
        wrapper.fulfillOracleQuery(abi.encode(1, 1, updateIds, updates));
        assertEq(mockPyth.updateDatas(0), 100);
        assertEq(mockPyth.updateDatas(1), 200);
        //assertEq(mockPyth.updateDatas(2), 0);
        mockPyth.reset();
    }

    function testGetBenchmarkPrice() external view {
        assertEq(wrapper.getBenchmarkPrice(testFeedId, 100), 1000);
    }
}
