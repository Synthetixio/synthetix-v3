// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file, var-name-mixedcase, func-name-mixedcase
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {RewardsDistributorExternal} from "../src/RewardsDistributorExternal.sol";
import {RewardsDistributor} from "@synthetixio/rewards-distributor/src/RewardsDistributor.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {MintableToken} from "./MintableToken.sol";

contract CoreProxyMock {
    uint128 public poolId;
    address public collateralType;
    uint256 public amount;
    uint64 public start;
    uint32 public duration;

    function distributeRewards(
        uint128 poolId_,
        address collateralType_,
        uint256 amount_,
        uint64 start_,
        uint32 duration_
    ) public {
        poolId = poolId_;
        collateralType = collateralType_;
        amount = amount_;
        start = start_;
        duration = duration_;
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

contract RewardsDistributorExternalTest is Test {
    address private ALICE;
    address private BOB;
    address private BOSS;
    address private EXTERNALDISTRIBUTOR;

    MintableToken internal sUSDC;
    MintableToken internal SNX;
    RewardsDistributorExternal internal rewardsDistributor;
    CoreProxyMock internal rewardsManager;

    uint128 internal accountId = 1;
    uint128 internal poolId = 1;
    address internal collateralType;
    uint64 internal start = 12345678;
    uint32 internal duration = 3600;

    function setUp() public {
        ALICE = vm.addr(0xA11CE);
        BOB = vm.addr(0xB0B);
        BOSS = vm.addr(0xB055);
        EXTERNALDISTRIBUTOR = vm.addr(0x1337);

        SNX = new MintableToken("SNX", 18);
        sUSDC = new MintableToken("sUSDC", 18);

        rewardsManager = new CoreProxyMock(BOSS);

        collateralType = address(sUSDC);

        address payoutToken = address(SNX);
        string memory name = "whatever";

        rewardsDistributor = new RewardsDistributorExternal(
            address(rewardsManager),
            poolId,
            collateralType,
            payoutToken,
            SNX.decimals(),
            name,
            address(EXTERNALDISTRIBUTOR)
        );
    }

    function test_constructor_arguments() public {
        assertEq(rewardsDistributor.rewardManager(), address(rewardsManager));
        assertEq(rewardsDistributor.name(), "whatever");
        assertEq(rewardsDistributor.collateralType(), address(sUSDC));
        assertEq(rewardsDistributor.payoutToken(), address(SNX));
        assertEq(rewardsDistributor.token(), address(SNX));
        assertEq(rewardsDistributor.authorizedExternalDistributor(), address(EXTERNALDISTRIBUTOR));
    }

    function test_payout() public {
        SNX.mint(address(rewardsDistributor), 1000e18);

        uint256 amount = 100e18;

        vm.startPrank(EXTERNALDISTRIBUTOR);
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();

        vm.startPrank(address(rewardsManager));
        assertTrue(rewardsDistributor.payout(accountId, poolId, collateralType, BOB, 10e18));
        vm.stopPrank();
    }

    function test_distributeRewards_AccessError() public {
        uint256 amount = 100e18;

        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, ALICE));

        vm.startPrank(ALICE);
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();
    }

    function test_distributeRewards_AccessError2() public {
        uint256 amount = 100e18;

        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, BOSS));

        vm.startPrank(BOSS);
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();
    }

    function test_distributeRewards() public {
        SNX.mint(address(rewardsDistributor), 1_000e18);

        uint256 amount = 100e18;

        vm.startPrank(EXTERNALDISTRIBUTOR);
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();

        assertEq(rewardsManager.poolId(), poolId);
        assertEq(rewardsManager.collateralType(), collateralType);
        assertEq(rewardsManager.amount(), amount);
        assertEq(rewardsManager.start(), start);
        assertEq(rewardsManager.duration(), duration);
    }
}
