// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "forge-std/mocks/MockERC20.sol";
import {console2} from "forge-std/console2.sol";
import {RewardsDistributor} from "../src/RewardsDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

contract FakeSNX is MockERC20 {
    constructor() {
        initialize("Fake SNX", "fSNX", 18);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract RewardsManagerModuleMock {
    uint128 public poolId;
    address public collateralType;
    uint256 public amount;
    uint64 public start;
    uint32 public duration;

    function distributeRewards(
        uint128 _poolId,
        address _collateralType,
        uint256 _amount,
        uint64 _start,
        uint32 _duration
    ) public {
        poolId = _poolId;
        collateralType = _collateralType;
        amount = _amount;
        start = _start;
        duration = _duration;
    }
}

contract RewardsDistributorTest is Test {
    FakeSNX internal fakeSnxToken;
    RewardsDistributor internal rewardsDistributor;
    RewardsManagerModuleMock internal rewardsManager;

    function setUp() public {
        fakeSnxToken = new FakeSNX();
        rewardsManager = new RewardsManagerModuleMock();
        rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            address(fakeSnxToken),
            "whatever"
        );
    }

    function test_constructor_arguments() public {
        assertEq(rewardsDistributor.name(), "whatever");
        assertEq(rewardsDistributor.token(), address(fakeSnxToken));
    }

    function test_setShouldFailPayout() public {
        assertEq(rewardsDistributor.shouldFailPayout(), false);
        rewardsDistributor.setShouldFailPayout(true);
        assertEq(rewardsDistributor.shouldFailPayout(), true);
        rewardsDistributor.setShouldFailPayout(false);
        assertEq(rewardsDistributor.shouldFailPayout(), false);
    }

    function test_payout_AccessError() public {
        uint128 accountId = 1;
        uint128 poolId = 1;

        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("Unauthorized(address)")), vm.addr(0xA11CE))
        );

        vm.startPrank(address(vm.addr(0xA11CE)));
        assertEq(
            rewardsDistributor.payout(
                accountId,
                poolId,
                address(fakeSnxToken),
                vm.addr(0xB0B),
                100
            ),
            false
        );
        vm.stopPrank();
    }

    function test_payout_underflow() public {
        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        vm.expectRevert(bytes("ERC20: subtraction underflow"));
        assertEq(
            rewardsDistributor.payout(
                accountId,
                poolId,
                address(fakeSnxToken),
                vm.addr(0xB0B),
                10e18
            ),
            false
        );
        vm.stopPrank();
    }

    function test_payout() public {
        fakeSnxToken.mint(address(rewardsDistributor), 1000e18);
        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        assertTrue(
            rewardsDistributor.payout(
                accountId,
                poolId,
                address(fakeSnxToken),
                vm.addr(0xB0B),
                10e18
            )
        );
        vm.stopPrank();
    }

    function test_distributeRewards() public {
        uint128 poolId = 1;
        uint256 amount = 100e18;
        uint64 start = 12345678;
        uint32 duration = 3600;
        rewardsDistributor.distributeRewards(
            poolId,
            address(fakeSnxToken),
            amount,
            start,
            duration
        );
        assertEq(rewardsManager.poolId(), poolId);
        assertEq(rewardsManager.collateralType(), address(fakeSnxToken));
        assertEq(rewardsManager.amount(), 100e18);
        assertEq(rewardsManager.start(), 12345678);
        assertEq(rewardsManager.duration(), 3600);
    }

    function test_onPositionUpdated() public {
        fakeSnxToken.mint(address(rewardsDistributor), 1000e18);
        uint128 accountId = 1;
        uint128 poolId = 1;
        uint256 actorSharesD18 = 123;
        rewardsDistributor.onPositionUpdated(
            accountId,
            poolId,
            address(fakeSnxToken),
            actorSharesD18
        ); // does nothing
    }

    function test_supportsInterface() public {
        assertEq(rewardsDistributor.supportsInterface(type(IRewardDistributor).interfaceId), true);
        bytes4 anotherInterface = bytes4(keccak256(bytes("123")));
        assertEq(rewardsDistributor.supportsInterface(anotherInterface), false);
    }
}
