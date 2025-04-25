// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../contracts/TreasuryStakingRewards.sol";

import "@synthetixio/core-contracts/contracts/interfaces/IERC721Receiver.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import "@synthetixio/main/contracts/mocks/CollateralMock.sol";
import "@synthetixio/main/contracts/mocks/MockMarket.sol";
import "@synthetixio/oracle-manager/contracts/mocks/MockV3Aggregator.sol";
import "@synthetixio/oracle-manager/contracts/modules/NodeModule.sol";

import {Test} from "forge-std/Test.sol";

import {CannonDeploy} from "../script/Deploy.sol";

interface IV3TestCoreProxy is IV3CoreProxy {
    function createAccount(uint128) external;
}

/* solhint-disable numcast/safe-cast */

contract TreasuryStakingRewardsTest is Test, IERC721Receiver {
    TreasuryStakingRewards private stakingRewards;
    CollateralMock stakingToken;
    IERC721 accountToken;
    IV3TestCoreProxy v3System;

    CannonDeploy deployer;

    uint128 accountId = 1234;

    function setUp() external {
        deployer = new CannonDeploy();
        deployer.run();
        accountToken = IERC721(deployer.getAddress("v3.AccountProxy"));
        stakingToken = CollateralMock(deployer.getAddress("v3.CollateralMock"));
        v3System = IV3TestCoreProxy(deployer.getAddress("v3.CoreProxy"));

        stakingRewards = new TreasuryStakingRewards(
            address(stakingToken),
            deployer.getAddress("Proxy"),
            address(1234)
        );

        // stake ourselves as a passive user
        v3System.createAccount(accountId);
        v3System.createAccount(accountId + 1);
        stakingToken.mint(address(this), 1000 ether);
    }

    function test_constructor() external {
        assertEq(stakingRewards.stakingToken(), address(stakingToken));
        assertEq(address(stakingRewards.treasuryMarket()), deployer.getAddress("Proxy"));
    }

    function test_Deposit() external {
        stakingToken.approve(address(stakingRewards), 2.25 ether);
        vm.expectCall(
            deployer.getAddress("Proxy"),
            abi.encodeWithSelector(ITreasuryMarket.reportAuxToken.selector, accountId)
        );
        stakingRewards.deposit(accountId, 1 ether);
        assertEq(stakingRewards.balanceOf(accountId), 1 ether);
        assertEq(stakingRewards.totalDeposited(), 1 ether);

        stakingRewards.deposit(accountId, 0.5 ether);
        stakingRewards.deposit(accountId + 1, 0.25 ether);
        assertEq(stakingRewards.balanceOf(accountId), 1.5 ether);
        assertEq(stakingRewards.balanceOf(accountId + 1), 0.25 ether);
        assertEq(stakingRewards.totalDeposited(), 1.75 ether);

        stakingRewards.deposit(accountId, 0.5 ether);
        assertEq(stakingRewards.balanceOf(accountId), 2 ether);
        assertEq(stakingRewards.totalDeposited(), 2.25 ether);

        assertEq(stakingToken.balanceOf(address(1234)), 2.25 ether);
    }

    function onERC721Received(
        address,
        /*operator*/
        address,
        /*from*/
        uint256,
        /*tokenId*/
        bytes memory /*data*/
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
