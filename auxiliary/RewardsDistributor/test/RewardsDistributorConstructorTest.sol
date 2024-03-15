// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {RewardsDistributor} from "../src/RewardsDistributor.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {MintableToken} from "./MintableToken.sol";

contract EmptyContract {
    // empty
}

contract RewardsDistributorConstructorTest is Test {
    address private BOB;
    address private BOSS;

    MintableToken internal sUSDC;
    EmptyContract internal rewardsManager;

    uint128 internal accountId = 1;
    uint128 internal poolId = 1;
    address internal collateralType;
    uint64 internal start = 12345678;
    uint32 internal duration = 3600;

    function setUp() public {
        BOB = vm.addr(0xB0B);
        rewardsManager = new EmptyContract();
        sUSDC = new MintableToken("sUSDC", 18);
        collateralType = address(sUSDC);
    }

    function test_constructor_wrongDecimalsSpecified() public {
        MintableToken T6D = new MintableToken("T6D", 6);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "payoutTokenDecimals",
                "Specified token decimals do not match actual token decimals"
            )
        );

        new RewardsDistributor(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T6D),
            18, // not matching the token 6 decimals
            "6 Decimals token payouts"
        );
    }

    function test_constructor_noDecimalsToken() public {
        EmptyContract TKN = new EmptyContract();
        RewardsDistributor rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            poolId,
            collateralType,
            address(TKN),
            18,
            "18 Decimals token payouts"
        );
        assertEq(rewardsDistributor.precision(), 10 ** 18);
    }
}
