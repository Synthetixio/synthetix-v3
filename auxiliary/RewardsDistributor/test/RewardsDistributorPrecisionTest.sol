// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {RewardsDistributor} from "../src/RewardsDistributor.sol";

import {MintableToken} from "./MintableToken.sol";

contract CoreProxyMock {
    uint256 public amount;
    function distributeRewards(
        uint128, // poolId_,
        address, // collateralType_,
        uint256 amount_,
        uint64, // start_,
        uint32 // duration_
    ) public {
        amount = amount_;
    }

    address public poolOwner;
    function getPoolOwner(
        uint128 // poolId_
    ) public view returns (address) {
        return poolOwner;
    }

    constructor(address poolOwner_) {
        poolOwner = poolOwner_;
    }
}

contract RewardsDistributorPrecisionTest is Test {
    address private BOB;
    address private BOSS;

    MintableToken internal sUSDC;
    CoreProxyMock internal rewardsManager;

    uint128 internal accountId = 1;
    uint128 internal poolId = 1;
    address internal collateralType;
    uint64 internal start = 12345678;
    uint32 internal duration = 3600;

    function setUp() public {
        BOB = vm.addr(0xB0B);
        BOSS = vm.addr(0xB055);
        rewardsManager = new CoreProxyMock(BOSS);
        sUSDC = new MintableToken("sUSDC", 18);
        collateralType = address(sUSDC);
    }

    function test_distributeRewards_lowerDecimalsToken() public {
        MintableToken T6D = new MintableToken("T6D", 6);
        RewardsDistributor rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T6D),
            T6D.decimals(),
            "6 Decimals token payouts"
        );
        T6D.mint(address(rewardsDistributor), 1_000e6); // 1000 T6D tokens

        assertEq(T6D.balanceOf(address(rewardsDistributor)), 1_000e6);
        assertEq(T6D.balanceOf(BOB), 0);

        uint256 distributionAmount = 100e6;

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(
            poolId,
            collateralType,
            distributionAmount,
            start,
            duration
        );
        vm.stopPrank();

        // check that rewards manager only deals with 18 decimals
        assertEq(rewardsManager.amount(), 100e18);

        uint256 fractionAmount = 0.001e6;

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(
            poolId,
            collateralType,
            fractionAmount,
            start,
            duration
        );
        vm.stopPrank();

        assertEq(rewardsManager.amount(), 0.001e18);
    }

    function test_distributeRewards_higherDecimalsToken() public {
        MintableToken T33D = new MintableToken("T33D", 33);
        RewardsDistributor rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T33D),
            T33D.decimals(),
            "33 Decimals token payouts"
        );
        T33D.mint(address(rewardsDistributor), 1_000e33); // 1000 T33D tokens

        assertEq(T33D.balanceOf(address(rewardsDistributor)), 1_000e33);
        assertEq(T33D.balanceOf(BOB), 0);

        uint256 distributionAmount = 100e33;

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(
            poolId,
            collateralType,
            distributionAmount,
            start,
            duration
        );
        vm.stopPrank();

        // check that rewards manager only deals with 18 decimals
        assertEq(rewardsManager.amount(), 100e18);

        uint256 fractionAmount = 0.001e33;

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(
            poolId,
            collateralType,
            fractionAmount,
            start,
            duration
        );
        vm.stopPrank();

        assertEq(rewardsManager.amount(), 0.001e18);
    }

    function test_payout_lowerDecimalsToken() public {
        MintableToken T6D = new MintableToken("T6D", 6);
        RewardsDistributor rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T6D),
            T6D.decimals(),
            "6 Decimals token payouts"
        );
        T6D.mint(address(rewardsDistributor), 1_000e6); // 1000 T6D tokens

        assertEq(T6D.balanceOf(address(rewardsDistributor)), 1_000e6);
        assertEq(T6D.balanceOf(BOB), 0);

        // Distribute 100 tokens, the number is in 6 dec precision, because it is called by pool owner BOSS
        uint256 distributionAmount = 100e6;

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(
            poolId,
            collateralType,
            distributionAmount,
            start,
            duration
        );
        vm.stopPrank();

        // Pay 10 tokens to BOB, the number is in 18 dec precision because it is called by Core
        uint256 payoutAmount = 10e18;

        vm.startPrank(address(rewardsManager));
        assertTrue(rewardsDistributor.payout(accountId, poolId, collateralType, BOB, payoutAmount));
        vm.stopPrank();

        assertEq(T6D.balanceOf(address(rewardsDistributor)), 990e6);
        assertEq(T6D.balanceOf(BOB), 10e6);
    }

    function test_payout_higherDecimalsToken() public {
        MintableToken T33D = new MintableToken("T33D", 33);
        RewardsDistributor rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T33D),
            T33D.decimals(),
            "33 Decimals token payouts"
        );
        T33D.mint(address(rewardsDistributor), 1_000e33); // 1000 T33D tokens

        assertEq(T33D.balanceOf(address(rewardsDistributor)), 1_000e33);
        assertEq(T33D.balanceOf(BOB), 0);

        // Distribute 100 tokens, the number is in 33 dec precision, because it is called by pool owner BOSS
        uint256 distributionAmount = 100e33;

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(
            poolId,
            collateralType,
            distributionAmount,
            start,
            duration
        );
        vm.stopPrank();

        // Pay 10 tokens to BOB, the number is in 18 dec precision because it is called by Core
        uint256 payoutAmount = 10e18;

        vm.startPrank(address(rewardsManager));
        assertTrue(rewardsDistributor.payout(accountId, poolId, collateralType, BOB, payoutAmount));
        vm.stopPrank();

        assertEq(T33D.balanceOf(address(rewardsDistributor)), 990e33);
        assertEq(T33D.balanceOf(BOB), 10e33);
    }
}
