// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Test} from "forge-std/Test.sol";
import {BuybackSnx} from "../contracts/BuybackSnx.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

/// @notice Regression test: BuybackSnx must reject snxFeeShare >= 100%
contract BuybackSnxFeeShareTest is Test {
    function test_constructor_rejects_100_percent_feeShare() public {
        // Should revert with 100% fee share
        vm.expectRevert("snxFeeShare must be < 100%");
        new BuybackSnx(
            0, // premium
            DecimalMath.UNIT, // snxFeeShare = 100%
            address(0x1234),
            bytes32("snx"),
            address(0x2345),
            address(0x3456)
        );
    }

    function test_constructor_rejects_over_100_percent_feeShare() public {
        // Should revert with > 100% fee share
        vm.expectRevert("snxFeeShare must be < 100%");
        new BuybackSnx(
            0, // premium
            DecimalMath.UNIT + 1, // snxFeeShare > 100%
            address(0x1234),
            bytes32("snx"),
            address(0x2345),
            address(0x3456)
        );
    }

    function test_constructor_accepts_valid_feeShare() public {
        // Should succeed with < 100% fee share
        BuybackSnx buyback = new BuybackSnx(
            0, // premium
            DecimalMath.UNIT / 2, // snxFeeShare = 50%
            address(0x1234),
            bytes32("snx"),
            address(0x2345),
            address(0x3456)
        );

        // Verify quoteFees returns half the amount
        uint256 feeAmount = 1000e18;
        uint256 quotedFee = buyback.quoteFees(0, feeAmount, address(this));
        assertEq(quotedFee, feeAmount / 2, "quoteFees should return 50% of feeAmount");
    }
}
