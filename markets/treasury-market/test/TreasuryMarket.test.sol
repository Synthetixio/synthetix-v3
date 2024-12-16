// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../contracts/TreasuryMarket.sol";

import "@synthetixio/main/contracts/mocks/CollateralMock.sol";
import "@synthetixio/main/contracts/mocks/MockMarket.sol";

import {Test} from "forge-std/Test.sol";

import {CannonDeploy} from "../script/Deploy.sol";

interface IV3TestCoreProxy is IV3CoreProxy {

}

contract TreasuryMarketTest is Test, IERC721Receiver {
    TreasuryMarket private market;
    IV3TestCoreProxy private v3System;
    CollateralMock private collateralToken;
    MockMarket private sideMarket;
    address private initialModuleBundleAddress;

    uint128 constant accountId = 25;
    uint128 constant poolId = 1;

    function setUp() external {
        CannonDeploy deployer = new CannonDeploy();
        deployer.run();
        market = TreasuryMarket(deployer.getAddress(keccak256("Proxy")));
        v3System = IV3TestCoreProxy(deployer.getAddress(keccak256("CoreProxy")));
        collateralToken = CollateralMock(deployer.getAddress(keccak256("CollateralMock")));
        initialModuleBundleAddress = deployer.getAddress(keccak256("InitialModuleBundle"));
        
        sideMarket = new MockMarket();
        uint128 sideMarketId = v3System.registerMarket(address(sideMarket));
        sideMarket.initialize(address(v3System), sideMarketId, 1 ether);

        vm.startPrank(v3System.owner());

        // for purposes of coverage, override the source code
        // TODO: need to find a better way to do this
        TreasuryMarket treasuryMarketCode = new TreasuryMarket(v3System, market.treasury(), poolId, address(collateralToken));
        vm.etch(deployer.getAddress(keccak256("MarketImpl")), address(treasuryMarketCode).code);

        // create v3 stuff
        v3System.createPool(poolId, v3System.owner());
        MarketConfiguration.Data[] memory marketConfig = new MarketConfiguration.Data[](2);
        marketConfig[0] = MarketConfiguration.Data(market.marketId(), 1, type(int128).max);
        marketConfig[1] = MarketConfiguration.Data(sideMarketId, 1, type(int128).max);
        v3System.setPoolConfiguration(poolId, marketConfig);

        v3System.configureCollateral(CollateralConfiguration.Data({
            depositingEnabled: true,
            issuanceRatioD18: 5 ether,
            liquidationRatioD18: 1.01 ether,
            liquidationRewardD18: 0,
            // const one oracle id (later replace with a better source for the constant)
            oracleNodeId: 0x066ef68c9d9ca51eee861aeb5bce51a12e61f06f10bf62243c563671ae3a9733,
            tokenAddress: address(collateralToken),
            minDelegationD18: 0
        }));

        vm.stopPrank();

        // stake
        collateralToken.mint(address(this), 100 ether);
        collateralToken.approve(address(v3System), 100 ether);

        for (uint128 i = 0;i < 2;i++) {
            v3System.createAccount(accountId + i);
            v3System.deposit(accountId + i, address(collateralToken), 10 ether);
        }

        v3System.delegateCollateral(accountId, poolId, address(collateralToken), 5 ether, 1 ether);
    }

    function testMarketFunctions() external {
        assertEq(market.name(market.marketId()), "Treasury Market");
        assertEq(market.reportedDebt(market.marketId()), 0);
        assertEq(market.minimumCredit(market.marketId()), 0);
    }

    function testFailMarketAlreadyRegistered() external {
        vm.prank(market.owner());
        market.registerMarket();
    }

    function testNewMarketRegistration() external {
        TreasuryMarket newMarket = new TreasuryMarket(v3System, market.treasury(), poolId, address(collateralToken));
        newMarket.registerMarket();

        assertTrue(newMarket.marketId() != 0);
        assertEq(IERC20(v3System.getUsdToken()).allowance(address(newMarket), address(v3System)), type(uint256).max);
    }

    function testFailSaddleInsufficientCRatio() external {
        sideMarket.setReportedDebt(4 ether);

        // delegate another account to cause the avg c-ratio to shoot way up
        v3System.delegateCollateral(accountId + 1, poolId, address(collateralToken), 5 ether, 1 ether);
        market.saddle(accountId);
        sideMarket.setReportedDebt(0);
    }

    function testSaddle() external {
        // add a little bit of debt to the account so we can verify saddle
        // works with debt in the account to start
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);
    }

    function testSaddleSecondAccount() external {
        // saddle the first account
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // saddle the second account
        v3System.delegateCollateral(accountId + 1, poolId, address(collateralToken), 5 ether, 1 ether);
        market.saddle(accountId + 1);
    }

    function testSaddleAgain() external {
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // saddle the second account
        v3System.delegateCollateral(accountId + 1, poolId, address(collateralToken), 5 ether, 1 ether);
        market.saddle(accountId + 1);
        // add some more debt from the side market
        sideMarket.setReportedDebt(3 ether);

        // delegate more collateral on the first account
        v3System.delegateCollateral(accountId, poolId, address(collateralToken), 10 ether, 1 ether);
        market.saddle(accountId);
    }

    function testFailTakeLoanUnauthorized() external {
        vm.prank(address(1000));
        market.adjustLoan(accountId, 1 ether);
    }

    function testFailTakeLoanInsufficientCRatio() external {
        market.saddle(accountId);
        market.adjustLoan(accountId, 10 ether);
    }

    function testTakeLoan() external {
        market.saddle(accountId);
        market.adjustLoan(accountId, 1 ether);
    }

    function testFailTakeLoanNoChange() external {
        market.saddle(accountId);
        market.adjustLoan(accountId, 1 ether);
        market.adjustLoan(accountId, 1 ether);
    }


    function testFailUnsaddleOutstandingLoan() external {
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);
        IERC721(v3System.getAccountTokenAddress()).approve(address(market), accountId);
        market.unsaddle(accountId);
    }

    function testFailUnsaddleNotSaddled() external {
        market.unsaddle(accountId);
    }

    function testRepayLoan() external {
        market.saddle(accountId);
        market.adjustLoan(accountId, 1 ether);
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        market.adjustLoan(accountId, 0);
    }

    function testFailTreasuryMintUnauthorized() external {
        market.mintTreasury(1 ether);
    }

    function testTreasuryMint() external {
        vm.prank(market.owner());
        market.mintTreasury(1 ether);
    }

    function testFailTreasuryBurnUnauthorized() external {
        vm.startPrank(market.treasury());
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        vm.stopPrank();
        market.burnTreasury(1 ether);
    }

    function testTreasuryBurn() external {
        vm.prank(market.owner());
        market.mintTreasury(1 ether);

        vm.startPrank(market.treasury());
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        vm.stopPrank();
        vm.prank(market.owner());
        market.burnTreasury(1 ether);
    }

    function testFailUnsaddleUnauthorized() external {
        market.saddle(accountId);
        vm.prank(address(1000));
        market.unsaddle(accountId);
    }

    function testUnsaddle() external {
        market.saddle(accountId);
        sideMarket.setReportedDebt(1 ether);

        // we need a second account to go ahead and repay the first account
        // (sort of means that this market can never be fully emptied without an actual repay by stakers at some point)
        v3System.delegateCollateral(accountId + 1, poolId, address(collateralToken), 10 ether, 1 ether);
        market.saddle(accountId + 1);

        IERC721(v3System.getAccountTokenAddress()).approve(address(market), accountId);
        market.unsaddle(accountId);
    }

    function testFailUpgradeToUnauthorized() external {
        market.upgradeTo(initialModuleBundleAddress);
    }

    function testUpgradeTo() external {
        vm.prank(market.owner());
        market.upgradeTo(initialModuleBundleAddress);
    }

    function testFailSetTargetCRatioUnauthorized() external {
        market.setTargetCRatio(3 ether);
    }

    function testSetTargetCRatio() external {
        vm.prank(market.owner());
        market.setTargetCRatio(3 ether);
    }

    function testSupportsInterface() external view {
        assertTrue(market.supportsInterface(type(IMarket).interfaceId));
        assertTrue(market.supportsInterface(market.supportsInterface.selector));
    }

    function onERC721Received(
        address,
        /*operator*/ address,
        /*from*/ uint256,
        /*tokenId*/ bytes memory /*data*/
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
