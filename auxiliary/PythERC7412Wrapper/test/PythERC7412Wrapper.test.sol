// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../contracts/PythERC7412Wrapper.sol";

import {Test} from "forge-std/Test.sol";

contract MockPythApi {
    function getPriceUnsafe() external view returns (PythStructs.Price memory price) {
        return PythStructs.Price(100, 0, -17, 0);
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
        wrapper.setBenchmarkPrice(testFeedId, 100, 1234);

        assertEq(wrapper.getBenchmarkPrice(testFeedId, 100), 1234);
    }

    function testGetBenchmarkPriceWithSkip() external {
        wrapper.setBenchmarkPrice(testFeedId, 100, -1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC7412.OracleDataRequired.selector,
                address(wrapper),
                hex"000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000649c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658"
            )
        );
        wrapper.getBenchmarkPrice(testFeedId, 100);
    }

    function testGetBenchmarkPrice() external view {
        assertEq(wrapper.getBenchmarkPrice(testFeedId, 100), 1000);
    }
}
