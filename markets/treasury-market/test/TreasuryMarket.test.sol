// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../contracts/TreasuryMarket.sol";

import "@synthetixio/main/contracts/mocks/CollateralMock.sol";
import "@synthetixio/main/contracts/mocks/MockMarket.sol";
import "@synthetixio/oracle-manager/contracts/mocks/MockV3Aggregator.sol";
import "@synthetixio/oracle-manager/contracts/modules/NodeModule.sol";

import {Test} from "forge-std/Test.sol";

import {CannonDeploy} from "../script/Deploy.sol";

interface IV3TestCoreProxy is IV3CoreProxy {}

/* solhint-disable numcast/safe-cast */

contract TreasuryMarketTest is Test, IERC721Receiver {
    TreasuryMarket private market;
    IV3TestCoreProxy private v3System;
    CollateralMock private collateralToken;
    MockMarket private sideMarket;
    address private initialModuleBundleAddress;

    address treasuryAddress = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    IERC20 private usdToken;

    MockV3Aggregator mockAggregator;

    uint128 constant accountId = 25;
    uint128 constant poolId = 1;

    function setUp() external {
        CannonDeploy deployer = new CannonDeploy();
        deployer.run();
        market = TreasuryMarket(deployer.getAddress(keccak256("Proxy")));
        v3System = IV3TestCoreProxy(deployer.getAddress(keccak256("CoreProxy")));
        usdToken = IERC20(deployer.getAddress(keccak256("USDProxy")));
        collateralToken = CollateralMock(deployer.getAddress(keccak256("CollateralMock")));
        initialModuleBundleAddress = deployer.getAddress(keccak256("InitialModuleBundle"));

        sideMarket = new MockMarket();
        uint128 sideMarketId = v3System.registerMarket(address(sideMarket));
        sideMarket.initialize(address(v3System), sideMarketId, 1 ether);

        assertTrue(address(market).code.length != 0);

        vm.startPrank(v3System.owner());

        // for purposes of coverage, override the source code
        // TODO: need to find a better way to do this
        TreasuryMarket treasuryMarketCode = new TreasuryMarket(
            v3System,
            market.treasury(),
            poolId,
            address(collateralToken)
        );
        vm.etch(deployer.getAddress(keccak256("MarketImpl")), address(treasuryMarketCode).code);

        market.setTargetCRatio(2 ether);

        // create v3 stuff
        v3System.createPool(poolId, v3System.owner());
        MarketConfiguration.Data[] memory marketConfig = new MarketConfiguration.Data[](2);
        marketConfig[0] = MarketConfiguration.Data(market.marketId(), 1, type(int128).max);
        marketConfig[1] = MarketConfiguration.Data(sideMarketId, 1, type(int128).max);
        v3System.setPoolConfiguration(poolId, marketConfig);

        mockAggregator = new MockV3Aggregator();
        mockAggregator.mockSetCurrentPrice(1 ether, 18);
        bytes32[] memory parents = new bytes32[](0);

        v3System.configureCollateral(
            CollateralConfiguration.Data({
                depositingEnabled: true,
                issuanceRatioD18: 5 ether,
                liquidationRatioD18: 1.01 ether,
                liquidationRewardD18: 0,
                // const one oracle id (later replace with a better source for the constant)
                oracleNodeId: NodeModule(0x83A0444B93927c3AFCbe46E522280390F748E171).registerNode(
                    NodeDefinition.NodeType.CHAINLINK,
                    abi.encode(address(mockAggregator), uint256(0), uint8(18)),
                    parents
                ),
                tokenAddress: address(collateralToken),
                minDelegationD18: 0
            })
        );

        vm.stopPrank();

        // stake
        collateralToken.mint(address(this), 1000 ether);
        collateralToken.approve(address(v3System), 1000 ether);

        for (uint128 i = 0; i < 2; i++) {
            v3System.createAccount(accountId + i);
            v3System.deposit(accountId + i, address(collateralToken), 50 ether);
        }

        v3System.delegateCollateral(accountId, poolId, address(collateralToken), 4 ether, 1 ether);

        vm.prank(v3System.owner());
        v3System.setFeatureFlagAllowAll("associateDebt", true);
    }

    function test_MarketFunctions() external view {
        assertEq(market.name(market.marketId()), "Treasury Market");
        assertEq(market.reportedDebt(market.marketId()), 0);
        assertEq(market.minimumCredit(market.marketId()), uint256(type(int256).max));
        assertEq(market.loanedAmount(42), 0);
        assertTrue(market.marketId() != 0);
    }

    function test_RevertIf_MarketAlreadyRegistered() external {
        vm.prank(market.owner());
        vm.expectRevert(
            abi.encodeWithSelector(ITreasuryMarket.MarketAlreadyRegistered.selector, 1)
        );
        market.registerMarket();
    }

    function test_NewMarketRegistration() external {
        TreasuryMarket newMarket = new TreasuryMarket(
            v3System,
            market.treasury(),
            poolId,
            address(collateralToken)
        );
        newMarket.registerMarket();

        assertTrue(newMarket.marketId() != 0);
        assertEq(
            IERC20(v3System.getUsdToken()).allowance(address(newMarket), address(v3System)),
            type(uint256).max
        );
    }

    function test_RevertIf_SaddleInsufficientCRatio() external {
        market.saddle(accountId);
        // delegate another account to cause the avg c-ratio to shoot way up5000000000000000000
        v3System.delegateCollateral(
            accountId + 1,
            poolId,
            address(collateralToken),
            4 ether,
            1 ether
        );

        // associate a lot of debt to this other account such that it has a really low c-ratio
        sideMarket.setReportedDebt(3 ether);
        sideMarket.callAssociateDebt(poolId, address(collateralToken), accountId + 1, 3 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                ITreasuryMarket.InsufficientCRatio.selector,
                accountId + 1,
                3 ether,
                2 ether
            )
        );
        market.saddle(accountId + 1);
    }

    function test_Saddle() external {
        // add a little bit of debt to the account so we can verify saddle
        // works with debt in the account to start
        sideMarket.setReportedDebt(1 ether);
        assertEq(v3System.getPositionDebt(accountId, poolId, address(collateralToken)), 1 ether);
        market.saddle(accountId);

        // this user is the first to saddle, so the debt should now be at 200% c-ratio and the debt increased on the current account
        assertEq(v3System.getVaultCollateralRatio(poolId, address(collateralToken)), 2 ether);
        assertEq(v3System.getPositionDebt(accountId, poolId, address(collateralToken)), 2 ether);
    }

    function test_SaddleSecondAccount() external {
        // saddle the first account
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // introduce second account joining the pool
        v3System.delegateCollateral(
            accountId + 1,
            poolId,
            address(collateralToken),
            1 ether,
            1 ether
        );

        // the second account comes into pool with some (0.25) debt
        sideMarket.setReportedDebt(1.25 ether);
        sideMarket.callAssociateDebt(poolId, address(collateralToken), accountId + 1, 0.25 ether);

        // saddle the second account
        market.saddle(accountId + 1);

        // the new account has 1/4 the amount of collateral, so it should have 1/4 the amount of debt
        assertEq(
            v3System.getPositionDebt(accountId + 1, poolId, address(collateralToken)) * 4,
            v3System.getPositionDebt(accountId, poolId, address(collateralToken))
        );
        assertEq(
            v3System.getPositionCollateralRatio(accountId + 1, poolId, address(collateralToken)),
            v3System.getPositionCollateralRatio(accountId, poolId, address(collateralToken))
        );
    }

    function test_SaddleAgain() external {
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // saddle the second account
        v3System.delegateCollateral(
            accountId + 1,
            poolId,
            address(collateralToken),
            2 ether,
            1 ether
        );
        market.saddle(accountId + 1);
        // add some more debt from the side market
        //sideMarket.setReportedDebt(2 ether);

        // delegate more collateral on the first account
        v3System.delegateCollateral(accountId, poolId, address(collateralToken), 8 ether, 1 ether);
        market.saddle(accountId);
        assertEq(
            v3System.getPositionDebt(accountId, poolId, address(collateralToken)),
            v3System.getPositionDebt(accountId + 1, poolId, address(collateralToken)) * 4
        );
    }

    function test_RevertIf_TakeLoanUnauthorized() external {
        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, address(1000)));
        vm.prank(address(1000));
        market.adjustLoan(accountId, 1 ether);
    }

    function test_RevertIf_TakeLoan() external {
        market.saddle(accountId);

        vm.expectRevert();
        market.adjustLoan(accountId, 1 ether);
    }

    function test_TakeLoanNoChange() external {
        market.saddle(accountId);
        market.adjustLoan(accountId, 0);
        assertEq(market.loanedAmount(accountId), 0);
    }

    function test_RevertIf_OutstandingLoan() external {
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);
        IERC721(v3System.getAccountTokenAddress()).approve(address(market), accountId);

        vm.expectRevert(
            abi.encodeWithSelector(ITreasuryMarket.OutstandingLoan.selector, accountId, 1 ether)
        );
        market.unsaddle(accountId);
    }

    function test_RevertIf_UnrepayableDebt() external {
        market.saddle(accountId);

        // mint some treasury money so the debt becomes fundamentally unrepayable
        vm.prank(market.owner());
        market.mintTreasury(1 ether);

        IERC721(v3System.getAccountTokenAddress()).approve(address(market), accountId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "accountCollateral",
                "no surplus collateral to fund exit"
            )
        );
        market.unsaddle(accountId);
    }

    function test_UnsaddleNotSaddled() external {
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "accountId",
                "not saddled"
            )
        );
        market.unsaddle(accountId);
    }

    function test_RevertIf_SetDebtDecayInvalidCases() external {
        vm.startPrank(market.owner());
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "debtDecayPower",
                "too high"
            )
        );
        market.setDebtDecayFunction(101, 86400, 0, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "startPenalty",
                "must be less than 1 ether"
            )
        );
        market.setDebtDecayFunction(100, 86400, 1.01 ether, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "endPenalty",
                "must be lte startPenalty"
            )
        );
        market.setDebtDecayFunction(100, 86400, 0.5 ether, 0.75 ether);

        // setting penalties to same values is ok though
        market.setDebtDecayFunction(100, 86400, 0.5 ether, 0.5 ether);

        vm.stopPrank();
    }

    function test_LoanDecayNoConfig() external {
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        (uint64 startTime, , , ) = market.loans(accountId);

        assertEq(market.loanedAmount(accountId), 1 ether);
        vm.warp(startTime + 1000000);
        assertEq(market.loanedAmount(accountId), 1 ether);
    }

    function test_LoanDecayLinearConfig() external {
        vm.warp(100000000);
        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 1000000, 0, 0);
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        (uint64 startTime, , , ) = market.loans(accountId);

        assertEq(market.loanedAmount(accountId), 1 ether);
        vm.warp(startTime + 500000);
        assertEq(market.loanedAmount(accountId), 0.5 ether);
        vm.warp(startTime + 1000000);
        assertEq(market.loanedAmount(accountId), 0);
        vm.warp(startTime + 1500000);
        assertEq(market.loanedAmount(accountId), 0);

        vm.warp(startTime - 500000);
        assertEq(market.loanedAmount(accountId), 1 ether);
    }

    function test_LoanDecayCubicConfig() external {
        vm.warp(100000000);
        vm.prank(market.owner());
        market.setDebtDecayFunction(3, 1000000, 0, 0);
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        (uint64 startTime, , , ) = market.loans(accountId);

        assertEq(market.loanedAmount(accountId), 1 ether);
        vm.warp(startTime + 500000);
        assertEq(market.loanedAmount(accountId), 0.875 ether);
        vm.warp(startTime + 1000000);
        assertEq(market.loanedAmount(accountId), 0);
        vm.warp(startTime + 1500000);
        assertEq(market.loanedAmount(accountId), 0);

        vm.warp(startTime - 500000);
        assertEq(market.loanedAmount(accountId), 1 ether);
    }

    function test_RepaymentPenaltyEdges() external {
        assertEq(market.repaymentPenalty(accountId, 0), 0);
        assertEq(market.repaymentPenalty(accountId, 0), 0);

        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 1000000, 1 ether, 0.5 ether);
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        vm.warp(1000000000000);

        assertEq(market.repaymentPenalty(accountId, 0), 0);
    }

    function test_RepayLoanMidScheduleLinearWithPenalty() external {
        vm.warp(100000000);
        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 1000000, 1 ether, 0.5 ether);
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // change the debt decay function just in case (calculations should still follow original debt decay params)
        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 2000000, 1 ether, 0.5 ether);

        (uint64 startTime, , , ) = market.loans(accountId);

        assertEq(market.loanedAmount(accountId), 1 ether);
        vm.warp(startTime + 500000);

        // take 1 ether of debt from the side market, which will allow us to repay potentially the full loan (but will actually be less)
        sideMarket.withdrawUsd(1 ether);
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);

        // verify that the reader function returns as expected
        assertEq(market.repaymentPenalty(accountId, 0), 0.375 ether);

        // first, try repaying theloan in full
        market.adjustLoan(accountId, 0);
        assertEq(market.loanedAmount(accountId), 0 ether);

        // the amount actually paid from the user's wallet is higher than the current amount of the loan (50% of 75% (avg of the two penalties) is the amount that didnt actually get repaid)
        assertEq(usdToken.balanceOf(address(this)), 0.125 ether);

        (uint64 newStartTime, uint32 power, uint32 duration, uint256 loanAmount) = market.loans(
            accountId
        );
        assertEq(newStartTime, startTime);
        assertEq(duration, 1000000);
        assertEq(power, 1);
        assertEq(loanAmount, 0 ether);
    }

    function test_RepayLoanMidScheduleLinearWithPenaltyHalf() external {
        vm.warp(100000000);
        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 1000000, 1 ether, 0.5 ether);
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // change the debt decay function just in case (calculations should still follow original debt decay params)
        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 2000000, 1 ether, 0.5 ether);

        (uint64 startTime, , , ) = market.loans(accountId);

        assertEq(market.loanedAmount(accountId), 1 ether);
        vm.warp(startTime + 500000);

        // take 1 ether of debt from the side market, which will allow us to repay potentially the full loan (but will actually be less)
        sideMarket.withdrawUsd(1 ether);
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        // repay the loan in half
        // verify that the reader function returns as expected
        assertEq(market.repaymentPenalty(accountId, 0.25 ether), 0.375 ether / 2);

        market.adjustLoan(accountId, 0.25 ether);
        assertEq(market.loanedAmount(accountId), 0.25 ether);

        // the amount actually paid from the user's wallet is higher than the current amount of the loan (50% of 75% (avg of the two penalties) is the amount that didnt actually get repaid)
        assertEq(usdToken.balanceOf(address(this)), 0.5625 ether);

        // pay off the rest
        market.adjustLoan(accountId, 0);
        assertEq(usdToken.balanceOf(address(this)), 0.125 ether);

        (uint64 newStartTime, uint32 power, uint32 duration, uint256 loanAmount) = market.loans(
            accountId
        );
        assertEq(newStartTime, startTime);
        assertEq(duration, 1000000);
        assertEq(power, 1);
        assertEq(loanAmount, 0 ether);
    }

    function test_RepayLoanMidScheduleCubic() external {
        vm.warp(100000000);
        vm.prank(market.owner());
        market.setDebtDecayFunction(3, 1000000, 0, 0);
        sideMarket.setReportedDebt(1 ether);
        market.saddle(accountId);

        // change the debt decay function just in case (calculations should still follow original debt decay params)
        vm.prank(market.owner());
        market.setDebtDecayFunction(1, 2000000, 0, 0);

        (uint64 startTime, , , ) = market.loans(accountId);

        assertEq(market.loanedAmount(accountId), 1 ether);
        vm.warp(startTime + 500000);

        // take 1 ether of debt from the side market, which will allow us to repay potentially the full loan (but will actually be less)
        sideMarket.withdrawUsd(1 ether);
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        market.adjustLoan(accountId, 0.4375 ether);
        assertEq(market.loanedAmount(accountId), 0.4375 ether);

        (uint64 newStartTime, uint32 power, uint32 duration, uint256 loanAmount) = market.loans(
            accountId
        );
        assertEq(newStartTime, startTime);
        assertEq(duration, 1000000);
        assertEq(power, 3);
        assertEq(loanAmount, 0.5 ether);
    }

    function test_RepayLoan() external {
        sideMarket.setReportedDebt(1 ether);

        market.saddle(accountId);
        assertEq(market.loanedAmount(accountId), 1 ether);

        // take 1 ether of debt from the side market, which will allow us to repay our loan
        sideMarket.withdrawUsd(1 ether);
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        market.adjustLoan(accountId, 0);
        assertEq(market.loanedAmount(accountId), 0);
    }

    function test_TreasuryMintUnauthorized() external {
        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, address(this)));
        market.mintTreasury(1 ether);
    }

    function test_TreasuryMint() external {
        market.saddle(accountId);

        assertEq(usdToken.balanceOf(market.treasury()), 0);

        vm.expectEmit();
        emit ITreasuryMarket.Rebalanced(3 ether, 2 ether);
        vm.prank(market.owner());
        market.mintTreasury(1 ether);

        assertEq(usdToken.balanceOf(market.treasury()), 1 ether);
        assertEq(v3System.getVaultCollateralRatio(poolId, address(collateralToken)), 2 ether);
    }

    function test_RevertIf_TreasuryBurnUnauthorized() external {
        vm.startPrank(market.treasury());
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, address(this)));
        market.burnTreasury(1 ether);
    }

    function test_TreasuryBurn() external {
        market.saddle(accountId);

        vm.prank(market.owner());
        market.mintTreasury(1 ether);

        vm.startPrank(market.treasury());
        IERC20(v3System.getUsdToken()).approve(address(market), 1 ether);
        vm.stopPrank();
        assertEq(usdToken.balanceOf(market.treasury()), 1 ether);

        vm.expectEmit();
        emit ITreasuryMarket.Rebalanced(1 ether, 2 ether);

        vm.prank(market.owner());
        market.burnTreasury(1 ether);
        assertEq(usdToken.balanceOf(market.treasury()), 0);
        assertEq(v3System.getVaultCollateralRatio(poolId, address(collateralToken)), 2 ether);
    }

    function test_RevertIf_UnsaddleUnauthorized() external {
        market.saddle(accountId);

        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, address(1000)));
        vm.prank(address(1000));
        market.unsaddle(accountId);
    }

    function test_Unsaddle() external {
        market.saddle(accountId);
        sideMarket.setReportedDebt(1 ether);

        // we need a second account to go ahead and repay the first account
        // (sort of means that this market can never be fully emptied without an actual repay by stakers at some point)
        v3System.delegateCollateral(
            accountId + 1,
            poolId,
            address(collateralToken),
            10 ether,
            1 ether
        );
        market.saddle(accountId + 1);

        sideMarket.setReportedDebt(0);

        IERC721(v3System.getAccountTokenAddress()).approve(address(market), accountId);
        market.unsaddle(accountId);
        assertEq(v3System.getPositionDebt(accountId, poolId, address(collateralToken)), 0);
    }

    function test_RevertIf_UpgradeToUnauthorized() external {
        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, address(this)));
        market.upgradeTo(initialModuleBundleAddress);
    }

    function test_RebalanceNoSaddle() external {
        // will not emit anything
        market.rebalance();
    }

    function test_RebalanceAfterSaddle() external {
        sideMarket.setReportedDebt(1 ether);
        assertEq(v3System.getPositionDebt(accountId, poolId, address(collateralToken)), 1 ether);
        market.saddle(accountId);

        vm.expectEmit();
        emit ITreasuryMarket.Rebalanced(2 ether, 2 ether);

        market.rebalance();

        sideMarket.setReportedDebt(0.5 ether);

        vm.expectEmit();
        emit ITreasuryMarket.Rebalanced(1.5 ether, 2 ether);

        market.rebalance();
    }

    function test_RebalanceInsufficientCollateral() external {
        sideMarket.setReportedDebt(1 ether);
        assertEq(v3System.getPositionDebt(accountId, poolId, address(collateralToken)), 1 ether);
        market.saddle(accountId);

        sideMarket.setReportedDebt(3 ether);

        vm.expectEmit();
        emit ITreasuryMarket.Rebalanced(3.5 ether, 2.5 ether);

        market.rebalance();
    }

    function test_ReportedDebtInvalidArtificialDebt() external {
        vm.store(address(market), bytes32(uint256(0)), bytes32(uint256(int256(-31337))));

        assertEq(market.reportedDebt(market.marketId()), 0);
    }

    function test_UpgradeTo() external {
        vm.prank(market.owner());
        market.upgradeTo(initialModuleBundleAddress);
    }

    function test_RevertIf_SetTargetCRatioUnauthorized() external {
        vm.expectRevert(abi.encodeWithSelector(AccessError.Unauthorized.selector, address(this)));
        market.setTargetCRatio(3 ether);
    }

    function test_SetTargetCRatio() external {
        vm.prank(market.owner());
        market.setTargetCRatio(3 ether);
    }

    function test_SupportsInterface() external view {
        assertTrue(market.supportsInterface(type(IMarket).interfaceId));
        assertTrue(market.supportsInterface(market.supportsInterface.selector));
    }

    function test_SaddleFlashLoanExploitDone() public {
        //v3System.delegateCollateral(accountId, poolId, address(collateralToken), 4 ether, 1 ether);
        market.saddle(accountId);

        v3System.delegateCollateral(
            accountId + 1,
            poolId,
            address(collateralToken),
            40 ether,
            1 ether
        );
        market.saddle(accountId + 1);

        // market.rebalance(); // doesn't change the result

        /// Some time in the future (sandwich attack an SNX price update)
        {
            // flash loan SNX
            collateralToken.mint(address(this), 43 ether);
            collateralToken.approve(address(v3System), 43 ether);

            v3System.createAccount(1337);
            v3System.deposit(1337, address(collateralToken), 43 ether);

            v3System.delegateCollateral(1337, poolId, address(collateralToken), 43 ether, 1 ether);

            market.saddle(1337);

            market.rebalance();

            IERC721(v3System.getAccountTokenAddress()).approve(address(market), 1337);
            market.unsaddle(1337); // No delegation timeout

            mockAggregator.mockSetCurrentPrice(0.995 ether, 18); // Price update that we MEV

            vm.expectRevert(
                abi.encodeWithSelector(
                    IV3CoreProxy.IneligibleForLiquidation.selector,
                    39800000000000000000,
                    20000000000000000000,
                    1990000000000000000,
                    1010000000000000000
                )
            );
            v3System.liquidate(accountId + 1, poolId, address(collateralToken), 1337);
        }
    }

    function test_UnsaddleBypassLoans() public {
        usdToken.approve(address(v3System), type(uint256).max);
        collateralToken.approve(address(v3System), type(uint256).max);
        collateralToken.approve(address(market), type(uint256).max);

        // Legitimate stakers
        {
            collateralToken.mint(address(this), 10000 ether);
            v3System.deposit(accountId, address(collateralToken), 10000 ether);
            v3System.delegateCollateral(
                accountId,
                poolId,
                address(collateralToken),
                10000 ether,
                1 ether
            );
            market.saddle(accountId);
        }

        vm.prank(treasuryAddress);
        market.mintTreasury(1 ether);

        uint128 otherPoolId = 2;
        v3System.createPool(otherPoolId, address(this));

        v3System.createAccount(1337);
        collateralToken.mint(address(this), 104 ether);
        v3System.deposit(1337, address(collateralToken), 104 ether);
        v3System.delegateCollateral(
            1337,
            otherPoolId,
            address(collateralToken),
            100 ether,
            1 ether
        );
        v3System.mintUsd(1337, otherPoolId, address(collateralToken), 20 ether);

        v3System.delegateCollateral(1337, poolId, address(collateralToken), 4 ether, 1 ether);
        market.saddle(1337);

        int256 debt = v3System.getPositionDebt(1337, poolId, address(collateralToken));
        v3System.burnUsd(1337, poolId, address(collateralToken), uint256(debt));

        IERC721(v3System.getAccountTokenAddress()).approve(address(market), 1337);
        market.unsaddle(1337);

        v3System.migrateDelegation(1337, otherPoolId, address(collateralToken), poolId);
        market.saddle(1337);

        IERC721(v3System.getAccountTokenAddress()).approve(address(market), 1337);

        vm.expectRevert(
            abi.encodeWithSelector(ITreasuryMarket.OutstandingLoan.selector, 1337, 20 ether)
        );
        market.unsaddle(1337);
    }

    function test_MigrateBypassLoans() public {
        usdToken.approve(address(v3System), type(uint256).max);
        collateralToken.approve(address(v3System), type(uint256).max);
        collateralToken.approve(address(market), type(uint256).max);

        uint128 otherPoolId = 2;
        v3System.createPool(otherPoolId, address(this));

        // Legitimate stakers
        {
            collateralToken.mint(address(this), 10000 ether);
            v3System.deposit(accountId, address(collateralToken), 10000 ether);
            v3System.delegateCollateral(
                accountId,
                poolId,
                address(collateralToken),
                10000 ether,
                1 ether
            );
            market.saddle(accountId);
        }

        vm.prank(treasuryAddress);
        market.mintTreasury(1 ether);

        // malicious account buys / flash loans 1 USD on the open market and 100 SNX
        vm.prank(treasuryAddress);
        usdToken.transfer(address(this), 1 ether);
        v3System.createAccount(1337);
        collateralToken.mint(address(this), 100 ether);

        v3System.deposit(1337, address(collateralToken), 2 ether);

        v3System.delegateCollateral(1337, poolId, address(collateralToken), 2 ether, 1 ether);
        market.saddle(1337);

        v3System.deposit(1337, address(usdToken), 1 ether);
        v3System.burnUsd(1337, poolId, address(collateralToken), 1 ether); // burn USD to get below issuance ratio of other pool

        // this should not be possible because of capacity locked
        vm.expectRevert(
            abi.encodeWithSelector(IV3CoreProxy.CapacityLocked.selector, market.marketId())
        );
        v3System.migrateDelegation(1337, poolId, address(collateralToken), otherPoolId);
    }

    function test_IncorrectTargetDebt() public {
        market.saddle(accountId);
        sideMarket.setReportedDebt(3 ether); // should make artificial debt zero
        market.rebalance();

        v3System.delegateCollateral(
            accountId + 1,
            poolId,
            address(collateralToken),
            4 ether,
            1 ether
        );
        market.saddle(accountId + 1);
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
