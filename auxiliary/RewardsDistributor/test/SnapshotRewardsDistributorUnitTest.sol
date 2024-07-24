// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "forge-std/mocks/MockERC20.sol";
import {MockERC721} from "forge-std/mocks/MockERC721.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {ERC20Helper} from "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {SnapshotRewardsDistributor} from "../src/SnapshotRewardsDistributor.sol";
import {IVaultModule} from "@synthetixio/main/contracts/interfaces/IVaultModule.sol";

contract FakeSNX is MockERC20 {
    constructor() {
        initialize("Fake SNX", "fSNX", 18);
    }
}

contract SNXAccount is MockERC721 {
    constructor() {
        initialize("SNX Account", "snxACC");
    }

    function mint(address to, uint256 id) public {
        _mint(to, id);
    }
}

contract CoreProxyMock {
    SNXAccount internal snxAccount;

    constructor(SNXAccount snxAccount_) {
        snxAccount = snxAccount_;
    }

    function getAccountTokenAddress() public view returns (address) {
        return address(snxAccount);
    }

    uint256 internal positionCollateral;

    function delegateCollateral(
        uint128, // accountId,
        uint128, // poolId,
        address, // collateralType,
        uint256 newCollateralAmountD18,
        uint256 // leverage
    ) public {
        positionCollateral = newCollateralAmountD18;
    }

    function getPositionCollateral(
        uint128, // accountId_
        uint128, // poolId_
        address // collateralType_
    ) public view returns (uint256 amount) {
        return positionCollateral;
    }
}

contract SnapshotRewardsDistributorUnitTest is Test {
    SNXAccount internal snxAccount;
    FakeSNX internal fakeSnxToken;
    SnapshotRewardsDistributor internal rewardsDistributor;
    address internal rewardsManager;

    function setUp() public {
        snxAccount = new SNXAccount();
        fakeSnxToken = new FakeSNX();
        CoreProxyMock coreProxyMock = new CoreProxyMock(snxAccount);
        rewardsManager = address(coreProxyMock);
        uint128 poolId = 1;
        rewardsDistributor = new SnapshotRewardsDistributor(
            rewardsManager,
            poolId,
            address(fakeSnxToken),
            vm.addr(0xA11CE)
        );
    }

    function test_constructor_arguments() public view {
        assertEq(rewardsDistributor.servicePoolId(), 1);
        assertEq(rewardsDistributor.serviceCollateralType(), address(fakeSnxToken));
        assertEq(rewardsDistributor.authorizedToSnapshot(vm.addr(0xA11CE)), true);
        assertEq(rewardsDistributor.currentPeriodId(), 0);
    }

    function test_payout() public view {
        assertTrue(rewardsDistributor.payout(123, 234, vm.addr(0xDEAD), vm.addr(0xB0B), 678));
    }

    function test_name() public view {
        assertEq(rewardsDistributor.name(), "snapshot tracker for governance");
    }

    function test_token() public view {
        assertEq(rewardsDistributor.token(), address(0));
    }

    function test_supportsInterface() public view {
        assertEq(rewardsDistributor.supportsInterface(type(IRewardDistributor).interfaceId), true);
        bytes4 anotherInterface = bytes4(keccak256(bytes("123")));
        assertEq(rewardsDistributor.supportsInterface(anotherInterface), false);
    }

    function test_takeSnapshot_AccessError() public {
        vm.startPrank(vm.addr(0xB0B));
        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, vm.addr(0xB0B)));
        rewardsDistributor.takeSnapshot(1);
        vm.stopPrank();
    }

    function test_takeSnapshot_WrongPeriodId() public {
        vm.startPrank(vm.addr(0xA11CE));
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "id",
                "period id must always increase"
            )
        );
        rewardsDistributor.takeSnapshot(0);
        vm.stopPrank();
    }

    function test_onPositionUpdated_AccessError() public {
        vm.startPrank(vm.addr(0xA11CE));
        vm.expectRevert(
            abi.encodeWithSelector(AccessError.Unauthorized.selector, vm.addr(0xA11CE))
        );
        uint128 accountId = 1;
        uint128 poolId = 1;
        address collateralType = address(fakeSnxToken);
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, 123);
        vm.stopPrank();
    }

    function test_onPositionUpdated_WrongPool() public {
        vm.startPrank(rewardsManager);
        vm.deal(rewardsManager, 1 ether);
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
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, 123);
        vm.stopPrank();
    }

    function test_onPositionUpdated_WrongCollateralType() public {
        vm.startPrank(rewardsManager);
        vm.deal(rewardsManager, 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        address collateralType = address(0xB0B);
        uint256 actorSharesD18 = 123;
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "collateralType",
                "Collateral does not match the rewards token"
            )
        );
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, actorSharesD18);
        vm.stopPrank();
    }

    function test_onPositionUpdated() public {
        snxAccount.mint(rewardsManager, 1);
        vm.deal(rewardsManager, 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        address collateralType = address(fakeSnxToken);

        assertEq(rewardsDistributor.currentPeriodId(), 0);
        IVaultModule(rewardsManager).delegateCollateral(accountId, poolId, collateralType, 100, 1);

        vm.startPrank(rewardsManager);
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, 123);
        vm.stopPrank();

        (uint128 amount0, uint128 periodId0, address owner0) = rewardsDistributor.balances(
            accountId,
            0
        );
        assertEq(amount0, 100);
        assertEq(periodId0, 0);
        assertEq(owner0, rewardsManager);

        IVaultModule(rewardsManager).delegateCollateral(accountId, poolId, collateralType, 9000, 1);
        vm.startPrank(rewardsManager);
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, 123);
        vm.stopPrank();

        (uint128 amount1, uint128 periodId1, address owner1) = rewardsDistributor.balances(
            accountId,
            0
        );
        assertEq(amount1, 9000);
        assertEq(periodId1, 0);
        assertEq(owner1, rewardsManager);
    }

    function test_takeSnapshot() public {
        vm.startPrank(vm.addr(0xA11CE));
        rewardsDistributor.takeSnapshot(1);
        vm.stopPrank();

        assertEq(rewardsDistributor.totalSupply(), 0);
        assertEq(rewardsDistributor.totalSupplyOnPeriod(0), 0);
        assertEq(rewardsDistributor.currentPeriodId(), 1);

        vm.startPrank(vm.addr(0xA11CE));
        rewardsDistributor.takeSnapshot(2);
        vm.stopPrank();

        assertEq(rewardsDistributor.totalSupply(), 0);
        assertEq(rewardsDistributor.totalSupplyOnPeriod(0), 0);
        assertEq(rewardsDistributor.totalSupplyOnPeriod(1), 0);
        assertEq(rewardsDistributor.currentPeriodId(), 2);
    }

    function test_onPositionUpdated_multiplePeriods() public {
        snxAccount.mint(vm.addr(0xB0B), 1);
        vm.deal(rewardsManager, 1 ether);
        uint128 accountId = 1;
        uint128 poolId = 1;
        address collateralType = address(fakeSnxToken);

        vm.startPrank(vm.addr(0xA11CE));
        rewardsDistributor.takeSnapshot(1);
        vm.stopPrank();

        assertEq(rewardsDistributor.totalSupply(), 0);
        assertEq(rewardsDistributor.totalSupplyOnPeriod(0), 0);

        assertEq(rewardsDistributor.balanceOf(accountId), 0);
        assertEq(rewardsDistributor.balanceOf(vm.addr(0xB0B)), 0);
        assertEq(rewardsDistributor.balanceOfOnPeriod(accountId, 0), 0);
        assertEq(rewardsDistributor.balanceOfOnPeriod(vm.addr(0xB0B), 0), 0);

        // for period 1 delegate 100
        IVaultModule(rewardsManager).delegateCollateral(accountId, poolId, collateralType, 100, 1);
        vm.startPrank(rewardsManager);
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, 123);
        vm.stopPrank();

        vm.startPrank(vm.addr(0xA11CE));
        rewardsDistributor.takeSnapshot(2);
        vm.stopPrank();

        assertEq(rewardsDistributor.totalSupply(), 100);
        assertEq(rewardsDistributor.totalSupplyOnPeriod(1), 100);

        assertEq(rewardsDistributor.balanceOf(accountId), 100);
        assertEq(rewardsDistributor.balanceOf(vm.addr(0xB0B)), 100);
        assertEq(rewardsDistributor.balanceOfOnPeriod(accountId, 1), 100);
        assertEq(rewardsDistributor.balanceOfOnPeriod(vm.addr(0xB0B), 1), 100);

        // for period 2 delegate 9000
        IVaultModule(rewardsManager).delegateCollateral(accountId, poolId, collateralType, 9000, 1);
        vm.startPrank(rewardsManager);
        rewardsDistributor.onPositionUpdated(accountId, poolId, collateralType, 123);
        vm.stopPrank();

        vm.startPrank(vm.addr(0xA11CE));
        rewardsDistributor.takeSnapshot(3);
        vm.stopPrank();

        assertEq(rewardsDistributor.totalSupply(), 9000);
        assertEq(rewardsDistributor.totalSupplyOnPeriod(2), 9000);

        assertEq(rewardsDistributor.balanceOf(accountId), 9000);
        assertEq(rewardsDistributor.balanceOf(vm.addr(0xB0B)), 9000);
        assertEq(rewardsDistributor.balanceOfOnPeriod(accountId, 2), 9000);
        assertEq(rewardsDistributor.balanceOfOnPeriod(vm.addr(0xB0B), 2), 9000);
    }
}
