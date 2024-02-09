// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "forge-std/mocks/MockERC20.sol";
import {console2} from "forge-std/console2.sol";
import {RewardsDistributor} from "../src/RewardsDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {ERC20Helper} from "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

contract FakeSNX is MockERC20 {
    constructor() {
        initialize("Fake SNX", "fSNX", 18);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

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

    function getPoolOwner(
        uint128 // poolId_
    ) public view returns (address) {
        return address(this);
    }
}

contract RewardsDistributorTest is Test {
    FakeSNX internal fakeSnxToken;
    RewardsDistributor internal rewardsDistributor;
    CoreProxyMock internal rewardsManager;

    function setUp() public {
        fakeSnxToken = new FakeSNX();
        rewardsManager = new CoreProxyMock();
        uint128 poolId = 1;
        rewardsDistributor = new RewardsDistributor(
            address(rewardsManager),
            poolId,
            address(fakeSnxToken),
            "whatever"
        );
    }

    function test_constructor_arguments() public {
        assertEq(rewardsDistributor.rewardManager(), address(rewardsManager));
        assertEq(rewardsDistributor.name(), "whatever");
        assertEq(rewardsDistributor.collateralType(), address(fakeSnxToken));
        assertEq(rewardsDistributor.token(), address(fakeSnxToken));
    }

    function test_setShouldFailPayout_AccessError() public {
        vm.startPrank(vm.addr(0xA11CE));
        vm.expectRevert(
            abi.encodeWithSelector(AccessError.Unauthorized.selector, vm.addr(0xA11CE))
        );
        rewardsDistributor.setShouldFailPayout(true);
        vm.stopPrank();
    }

    function test_setShouldFailPayout() public {
        vm.startPrank(address(rewardsManager));
        assertEq(rewardsDistributor.shouldFailPayout(), false);
        rewardsDistributor.setShouldFailPayout(true);
        assertEq(rewardsDistributor.shouldFailPayout(), true);
        rewardsDistributor.setShouldFailPayout(false);
        assertEq(rewardsDistributor.shouldFailPayout(), false);
        vm.stopPrank();
    }

    function test_payout_AccessError() public {
        uint128 accountId = 1;
        uint128 poolId = 1;

        vm.startPrank(vm.addr(0xA11CE));
        vm.expectRevert(
            abi.encodeWithSelector(AccessError.Unauthorized.selector, vm.addr(0xA11CE))
        );
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

    function test_payout_WrongPool() public {
        fakeSnxToken.mint(address(rewardsDistributor), 1000e18);
        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 2;
        address collateralType = address(fakeSnxToken);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "poolId",
                "Pool does not match the rewards pool"
            )
        );
        assertEq(
            rewardsDistributor.payout(accountId, poolId, collateralType, vm.addr(0xB0B), 10e18),
            false
        );
        vm.stopPrank();
    }

    function test_payout_WrongCollateralType() public {
        fakeSnxToken.mint(address(rewardsDistributor), 1000e18);
        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        address collateralType = address(0xB0B);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "collateralType",
                "Collateral does not match the rewards token"
            )
        );
        assertEq(
            rewardsDistributor.payout(accountId, poolId, collateralType, vm.addr(0xB0B), 10e18),
            false
        );
        vm.stopPrank();
    }

    function test_payout_underflow() public {
        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20Helper.FailedTransfer.selector,
                address(rewardsDistributor),
                vm.addr(0xB0B),
                10e18
            )
        );
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

    function test_payout_shouldFail() public {
        fakeSnxToken.mint(address(rewardsDistributor), 1000e18);
        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        rewardsDistributor.setShouldFailPayout(true);
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

    function test_distributeRewards_AccessError() public {
        uint128 poolId = 1;
        address collateralType = address(fakeSnxToken);
        uint256 amount = 100e18;
        uint64 start = 12345678;
        uint32 duration = 3600;

        vm.startPrank(vm.addr(0xA11CE));
        vm.deal(address(rewardsManager), 1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(AccessError.Unauthorized.selector, vm.addr(0xA11CE))
        );
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();
    }

    function test_distributeRewards_WrongPool() public {
        uint128 poolId = 2;
        address collateralType = address(fakeSnxToken);
        uint256 amount = 100e18;
        uint64 start = 12345678;
        uint32 duration = 3600;

        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "poolId",
                "Pool does not match the rewards pool"
            )
        );
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();
    }

    function test_distributeRewards_WrongCollateralType() public {
        uint128 poolId = 1;
        address collateralType = address(0xB0B);
        uint256 amount = 100e18;
        uint64 start = 12345678;
        uint32 duration = 3600;

        vm.startPrank(address(rewardsManager));
        vm.deal(address(rewardsManager), 1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "collateralType",
                "Collateral does not match the rewards token"
            )
        );
        rewardsDistributor.distributeRewards(poolId, collateralType, amount, start, duration);
        vm.stopPrank();
    }

    function test_distributeRewards() public {
        uint128 poolId = 1;
        uint256 amount = 100e18;
        uint64 start = 12345678;
        uint32 duration = 3600;
        vm.startPrank(address(rewardsManager));
        rewardsDistributor.distributeRewards(
            poolId,
            address(fakeSnxToken),
            amount,
            start,
            duration
        );
        vm.stopPrank();
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
