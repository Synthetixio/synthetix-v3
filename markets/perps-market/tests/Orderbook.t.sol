// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {BootstrapTest} from "./Bootstrap.t.sol";
import {IBookOrderModule} from "../contracts/interfaces/IBookOrderModule.sol";
import {
    SafeCastU256,
    SafeCastI256,
    SafeCastU128,
    SafeCastI128
} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {console} from "forge-std/console.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";

contract OrderbookTest is BootstrapTest {
    using SafeCastI128 for int256;
    using SafeCastU128 for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    uint128 marketId;

    // Starting account IDs for batch tests to avoid collisions
    uint128 constant ACCOUNT_ID_10_MATCHES = 17014118346046923173168730371588410;
    uint128 constant ACCOUNT_ID_100_MATCHES = 17014118346046923173168730371588010;
    uint128 constant ACCOUNT_ID_25_MATCHES = 17014118346046923173168730371508210;

    IBookOrderModule.BookOrder[] orders200;

    function _fundAndDelegateToMarket(uint128 accountIdToFund, uint256 amount) internal {
        // console.log("accountIdToFund", accountIdToFund);
        if (accountIdToFund == alice) {
            vm.prank(trader1);
        }
        if (accountIdToFund == bob) {
            vm.prank(trader2);
        }
        core.createAccount(accountIdToFund);
        perps.createAccount(accountIdToFund);
        perps.setBookMode(accountIdToFund, true);
        address accountOwner = perps.getAccountOwner(accountIdToFund);

        vm.startPrank(accountOwner);
        collateralToken.mint(accountOwner, amount);
        collateralToken.approve(address(core), amount);
        core.deposit(accountIdToFund, address(collateralToken), amount);

        core.delegateCollateral(accountIdToFund, poolId, address(collateralToken), amount, 1 ether);

        NodeOutput.Data memory nodeOutput = oracleManager.process(collateralConfig.oracleNodeId);
        int256 collateralPrice = nodeOutput.price;
        // uint256 sUSDToMint = (amount * uint256(collateralPrice)) / collateralConfig.issuanceRatioD18;
        uint256 sUSDToMint = (amount / collateralConfig.issuanceRatioD18);
        // console.log("collateralPrice", collateralPrice);
        // console.log("issuanceRatioD18", collateralConfig.issuanceRatioD18);
        // console.log("sUSDToMint", sUSDToMint);
        core.mintUsd(accountIdToFund, poolId, address(collateralToken), sUSDToMint);
        core.withdraw(accountIdToFund, address(usdToken), sUSDToMint);

        usdToken.approve(address(perps), sUSDToMint);
        perps.modifyCollateral(accountIdToFund, collateralId, int256(sUSDToMint));
        vm.stopPrank();
    }

    function setUp() public override {
        super.setUp();
        marketId = ethMarketId;

        console.log("marketId", marketId);

        for (uint128 i = 0; i < 10; i++) {
            _fundAndDelegateToMarket(ACCOUNT_ID_10_MATCHES + i, 10_00e18);
            _fundAndDelegateToMarket(ACCOUNT_ID_10_MATCHES + i + 11, 10_000e18);
        }
        console.log("finish funding 10 matches");
        for (uint128 i = 0; i < 100; i++) {
            _fundAndDelegateToMarket(ACCOUNT_ID_100_MATCHES + i, 20_000e18);
            _fundAndDelegateToMarket(ACCOUNT_ID_100_MATCHES + i + 101, 20_000e18);
        }
        console.log("finish funding 100 matches");
        for (uint128 i = 0; i < 25; i++) {
            _fundAndDelegateToMarket(ACCOUNT_ID_25_MATCHES + i, 20_000e18);
            _fundAndDelegateToMarket(ACCOUNT_ID_25_MATCHES + i + 26, 20_000e18);
            _fundAndDelegateToMarket(ACCOUNT_ID_25_MATCHES + i + 51, 20_000e18);
        }
        console.log("finish funding 25 matches");


        _prepareHundredMatches();
    }

    function _prepareHundredMatches() internal {
        uint256 numMatches = 100;
        uint256 numOrders = numMatches * 2;

        uint128[] memory accountIds = new uint128[](numOrders);
        int128[] memory sizeDeltas = new int128[](numOrders);
        uint256[] memory orderPrices = new uint256[](numOrders);
        bytes32[] memory trackingCodes = new bytes32[](numOrders);

        for (uint256 i = 0; i < numMatches; i++) {
            uint256 buyerIndex = 2 * i;
            uint256 sellerIndex = buyerIndex + 1;

            // Buyer
            accountIds[buyerIndex] = ACCOUNT_ID_100_MATCHES + i.to128();
            sizeDeltas[buyerIndex] = 0.1e18; // Long 0.1 ETH
            orderPrices[buyerIndex] = 3000e18; // Constant price for simplicity
            // trackingCodes[buyerIndex] = bytes32(abi.encodePacked("BUY100_", i));

            // Seller
            accountIds[sellerIndex] = ACCOUNT_ID_100_MATCHES + (i + 101).to128();
            sizeDeltas[sellerIndex] = -0.1e18; // Short 0.1 ETH
            orderPrices[sellerIndex] = 3000e18;
            // trackingCodes[sellerIndex] = bytes32(abi.encodePacked("SELL100_", i));
        }
        IBookOrderModule.BookOrder[] memory orders = _createBookOrders(
            accountIds,
            sizeDeltas,
            orderPrices,
            trackingCodes
        );

        // Sort orders by accountId before settling
        orders = _sortOrdersByAccountId(orders);
        for (uint i = 0; i < orders.length; i++) {
            orders200.push(orders[i]);
        }
    }

    // Helper function to sort orders by accountId (ascending)
    function _sortOrdersByAccountId(
        IBookOrderModule.BookOrder[] memory _orders
    ) internal pure returns (IBookOrderModule.BookOrder[] memory) {
        uint256 n = _orders.length;
        if (n == 0) {
            return _orders;
        }
        IBookOrderModule.BookOrder[] memory sortedOrders = new IBookOrderModule.BookOrder[](n);
        for (uint256 i = 0; i < n; i++) {
            sortedOrders[i] = _orders[i];
        }

        for (uint256 i = 1; i < n; i++) {
            IBookOrderModule.BookOrder memory key = sortedOrders[i];
            uint256 j = i;
            while (j > 0 && sortedOrders[j - 1].accountId > key.accountId) {
                sortedOrders[j] = sortedOrders[j - 1];
                j--;
            }
            sortedOrders[j] = key;
        }
        return sortedOrders;
    }

    function _createBookOrders(
        uint128[] memory accountIds,
        int128[] memory sizeDeltas,
        uint256[] memory orderPrices,
        bytes32[] memory trackingCodes
    ) internal pure returns (IBookOrderModule.BookOrder[] memory) {
        require(
            accountIds.length == sizeDeltas.length &&
                accountIds.length == orderPrices.length &&
                accountIds.length == trackingCodes.length,
            "Input array length mismatch"
        );

        IBookOrderModule.BookOrder[] memory orders = new IBookOrderModule.BookOrder[](
            accountIds.length
        );
        for (uint256 i = 0; i < accountIds.length; i++) {
            orders[i] = IBookOrderModule.BookOrder({
                accountId: accountIds[i],
                sizeDelta: sizeDeltas[i],
                orderPrice: orderPrices[i],
                signedPriceData: "", // Not testing signed prices for now
                trackingCode: trackingCodes[i]
            });
        }
        return orders;
    }

    function testSettleBookOrders_1_Match() public {
        uint128[] memory accountIds = new uint128[](2);
        vm.startPrank(trader1);
        uint128 aliceId = perps.createAccount();
        perps.setBookMode(aliceId, true);
        vm.stopPrank();

        vm.startPrank(trader2);
        uint128 bobId = perps.createAccount();
        perps.setBookMode(bobId, true);
        vm.stopPrank();

        accountIds[0] = aliceId; // Alice is first
        accountIds[1] = bobId; // Bob is second

        int128[] memory sizeDeltas = new int128[](2);
        sizeDeltas[0] = 1e18; // Alice buys 1 ETH
        sizeDeltas[1] = -1e18; // Bob sells 1 ETH

        uint256[] memory orderPrices = new uint256[](2);
        orderPrices[0] = 3000e18; // Alice's order price
        orderPrices[1] = 3000e18; // Bob's order price (settlement price)

        bytes32[] memory trackingCodes = new bytes32[](2);
        trackingCodes[0] = bytes32("ALICE01");
        trackingCodes[1] = bytes32("BOB01");

        IBookOrderModule.BookOrder[] memory orders = _createBookOrders(
            accountIds,
            sizeDeltas,
            orderPrices,
            trackingCodes
        );

        // Sort orders by accountId before settling
        orders = _sortOrdersByAccountId(orders);

        IBookOrderModule.BookOrderSettleStatus[] memory cancelledOrders = perps.settleBookOrders(
            marketId,
            orders
        );

        assertEq(cancelledOrders.length, 0, "Expected none cancelled orders");

        // Check positions
        (int256 alicePnl, , int128 aliceSize, ) = perps.getOpenPosition(aliceId, marketId);
        (int256 bobPnl, , int128 bobSize, ) = perps.getOpenPosition(bobId, marketId);

        assertEq(aliceSize, 1e18, "Alice's position size incorrect");
        assertEq(bobSize, -1e18, "Bob's position size incorrect");
    }

    function testSettleBookOrders_10_Matches() public {
        uint256 numMatches = 10;
        uint256 numOrders = numMatches * 2;

        uint128[] memory accountIds = new uint128[](numOrders);
        int128[] memory sizeDeltas = new int128[](numOrders);
        uint256[] memory orderPrices = new uint256[](numOrders);
        bytes32[] memory trackingCodes = new bytes32[](numOrders);

        for (uint256 i = 0; i < numMatches; i++) {
            uint256 buyerIndex = 2 * i;
            uint256 sellerIndex = buyerIndex + 1;

            // Buyer
            accountIds[buyerIndex] = ACCOUNT_ID_10_MATCHES + i.to128();
            sizeDeltas[buyerIndex] = 0.3e18; // Buy 0.3 ETH
            orderPrices[buyerIndex] = 3000e18 + (i * 1e18); // Slightly varying prices: 3000, 3001, ...
            // trackingCodes[buyerIndex] = bytes32(abi.encodePacked("BUY10_", i));

            // Seller
            accountIds[sellerIndex] = ACCOUNT_ID_10_MATCHES + (i + 11).to128();
            sizeDeltas[sellerIndex] = -0.1e18; // Sell 0.1 ETH
            orderPrices[sellerIndex] = 3000e18 + (i * 1e18); // Matching settlement price
            // trackingCodes[sellerIndex] = bytes32(abi.encodePacked("SELL10_", i));
        }

        IBookOrderModule.BookOrder[] memory orders = _createBookOrders(
            accountIds,
            sizeDeltas,
            orderPrices,
            trackingCodes
        );

        // Sort orders by accountId before settling
        orders = _sortOrdersByAccountId(orders);

        IBookOrderModule.BookOrderSettleStatus[] memory cancelledOrders = perps.settleBookOrders(
            marketId,
            orders
        );

        assertEq(cancelledOrders.length, 0, "Expected no cancelled orders");

        // Check a few positions
        for (uint256 i = 0; i < numMatches; i++) {
            uint128 buyerId = ACCOUNT_ID_10_MATCHES + i.to128();
            uint128 sellerId = ACCOUNT_ID_10_MATCHES + (i + 11).to128();

            (, , int128 buyerSize, ) = perps.getOpenPosition(buyerId, marketId);
            (, , int128 sellerSize, ) = perps.getOpenPosition(sellerId, marketId);

            assertEq(buyerSize, 0.3e18, "Buyer position size incorrect (10 matches)");
            assertEq(sellerSize, -0.1e18, "Seller position size incorrect (10 matches)");
        }
    }

    // function testSettleBookOrders_hundredMatches() public {

    //     IBookOrderModule.BookOrderSettleStatus[] memory cancelledOrders = perps.settleBookOrders(
    //         marketId,
    //         orders200
    //     );

    //     assertEq(cancelledOrders.length, 0, "Expected no cancelled orders");

    //     // Check a sample of positions
    //     for (int128 i = 0; i < 100; i = i + 10) {
    //         uint128 buyerId = ACCOUNT_ID_100_MATCHES + uint128(i);
    //         uint128 sellerId = ACCOUNT_ID_100_MATCHES + uint128(int128(i) + 101);

    //         (, , int128 buyerSize, ) = perps.getOpenPosition(buyerId, marketId);
    //         (, , int128 sellerSize, ) = perps.getOpenPosition(sellerId, marketId);
    //         // console.log("Buyer id", buyerId);
    //         // console.log("Buyer position size", buyerSize);
    //         // console.log("Seller id", sellerId);
    //         // console.log("Seller position size", sellerSize);
    //         assertEq(buyerSize, 0.1e18, "Buyer position size incorrect (100 matches)");
    //         assertEq(sellerSize, -0.1e18, "Seller position size incorrect (100 matches)");
    //     }
    // }


    function testSettleBookOrders_25_UniqueMatches() public {
        uint256 numMatches = 25;
        uint256 numOrders = numMatches * 2;

        uint128[] memory accountIds = new uint128[](numOrders);
        int128[] memory sizeDeltas = new int128[](numOrders);
        uint256[] memory orderPrices = new uint256[](numOrders);
        bytes32[] memory trackingCodes = new bytes32[](numOrders);

        for (uint256 i = 0; i < numMatches; i++) {
            uint256 buyerIndex = 2 * i;
            uint256 sellerIndex = buyerIndex + 1;

            // Buyer
            accountIds[buyerIndex] = ACCOUNT_ID_25_MATCHES + i.to128();
            sizeDeltas[buyerIndex] = 0.3e18; // Buy 0.3 ETH
            orderPrices[buyerIndex] = 3000e18 + (i * 1e18); // Slightly varying prices: 3000, 3001, ...
            // trackingCodes[buyerIndex] = bytes32(abi.encodePacked("BUY10_", i));

            // Seller
            accountIds[sellerIndex] = ACCOUNT_ID_25_MATCHES + (i + 26).to128();
            sizeDeltas[sellerIndex] = -0.1e18; // Sell 0.1 ETH
            orderPrices[sellerIndex] = 3000e18 + (i * 1e18); // Matching settlement price
            // trackingCodes[sellerIndex] = bytes32(abi.encodePacked("SELL10_", i));
        }

        IBookOrderModule.BookOrder[] memory orders = _createBookOrders(
            accountIds,
            sizeDeltas,
            orderPrices,
            trackingCodes
        );

        // Sort orders by accountId before settling
        orders = _sortOrdersByAccountId(orders);

        IBookOrderModule.BookOrderSettleStatus[] memory cancelledOrders = perps.settleBookOrders(
            marketId,
            orders
        );

        assertEq(cancelledOrders.length, 0, "Expected no cancelled orders");

        // Check a few positions
        for (uint256 i = 0; i < numMatches; i++) {
            uint128 buyerId = ACCOUNT_ID_25_MATCHES + i.to128();
            uint128 sellerId = ACCOUNT_ID_25_MATCHES + (i + 26).to128();

            (, , int128 buyerSize, ) = perps.getOpenPosition(buyerId, marketId);
            (, , int128 sellerSize, ) = perps.getOpenPosition(sellerId, marketId);

            assertEq(buyerSize, 0.3e18, "Buyer position size incorrect (25 matches)");
            assertEq(sellerSize, -0.1e18, "Seller position size incorrect (25 matches)");
        }
    }

        function testSettleBookOrders_25_MatchesV2() public {
        uint256 numMatches = 25;
        uint256 numOrders = numMatches * 2;

        uint128[] memory accountIds = new uint128[](numOrders);
        int128[] memory sizeDeltas = new int128[](numOrders);
        uint256[] memory orderPrices = new uint256[](numOrders);
        bytes32[] memory trackingCodes = new bytes32[](numOrders);

        for (uint256 i = 0; i < numMatches; i++) {
            uint256 buyerIndex = 2 * i;
            uint256 sellerIndex = buyerIndex + 1;

            // Buyer
            accountIds[buyerIndex] = ACCOUNT_ID_25_MATCHES + i.to128();
            sizeDeltas[buyerIndex] = 0.3e18; // Buy 0.3 ETH
            orderPrices[buyerIndex] = 3000e18 + (i * 1e18); // Slightly varying prices: 3000, 3001, ...
            // trackingCodes[buyerIndex] = bytes32(abi.encodePacked("BUY10_", i));
            // Seller
            accountIds[sellerIndex] = ACCOUNT_ID_25_MATCHES + (i % 2 == 0 ? 26 : 51);
            sizeDeltas[sellerIndex] = -0.1e18; // Sell 0.1 ETH
            orderPrices[sellerIndex] = 3000e18 + (i * 1e18); // Matching settlement price
            // trackingCodes[sellerIndex] = bytes32(abi.encodePacked("SELL10_", i));
            // console.log("Buyer id", accountIds[buyerIndex]);
            console.log("Seller id", accountIds[sellerIndex]);
        }

        IBookOrderModule.BookOrder[] memory orders = _createBookOrders(
            accountIds,
            sizeDeltas,
            orderPrices,
            trackingCodes
        );

        // Sort orders by accountId before settling
        orders = _sortOrdersByAccountId(orders);

        IBookOrderModule.BookOrderSettleStatus[] memory cancelledOrders = perps.settleBookOrders(
            marketId,
            orders
        );

        assertEq(cancelledOrders.length, 0, "Expected no cancelled orders");

        // Check a few positions
        for (uint256 i = 0; i < numMatches; i++) {
            uint128 buyerId = ACCOUNT_ID_25_MATCHES + i.to128();
            uint128 sellerId = ACCOUNT_ID_25_MATCHES + (i % 2 == 0 ? 26 : 51);

            (, , int128 buyerSize, ) = perps.getOpenPosition(buyerId, marketId);
            (, , int128 sellerSize, ) = perps.getOpenPosition(sellerId, marketId);

            assertEq(buyerSize, 0.3e18, "Buyer position size incorrect (25 matches)");
            // assertEq(sellerSize, -0.1e18, "Seller position size incorrect (25 matches)");
        }
    }
}
