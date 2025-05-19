// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Test} from "forge-std/Test.sol";

import {CannonDeploy} from "../script/Deploy.sol";
import {IPerpsMarketProxy} from "./interfaces/IPerpsMarketProxy.sol";
import {
    IV3CoreProxy,
    MarketConfiguration,
    CollateralConfiguration
} from "./interfaces/IV3CoreProxy.sol";
import {MockV3Aggregator} from "@synthetixio/oracle-manager/contracts/mocks/MockV3Aggregator.sol";
import {CollateralMock} from "@synthetixio/main/contracts/mocks/CollateralMock.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import {IOracleManagerProxy} from "./interfaces/IOracleManagerProxy.sol";
import {
    IERC721Receiver
} from "@synthetixio/core-contracts/contracts/interfaces/IERC721Receiver.sol";
import "@synthetixio/oracle-manager/contracts/modules/NodeModule.sol";
import {console} from "forge-std/console.sol";
import {ICollateralConfigurationModule} from "../contracts/interfaces/ICollateralConfigurationModule.sol";
import {IGlobalPerpsMarketModule} from "../contracts/interfaces/IGlobalPerpsMarketModule.sol";

contract BootstrapTest is Test, IERC721Receiver {
    address trader1 = address(0x111);
    address trader2 = address(0x222);
    address whale = address(0x333);

    IPerpsMarketProxy perps;
    IV3CoreProxy core;
    IOracleManagerProxy oracleManager;

    IERC20 usdToken;
    IERC721 accountNft;
    CollateralMock collateralToken;
    MockV3Aggregator mockAggregator;
    MockV3Aggregator ethMockAggregator;
    MockV3Aggregator superMockAggregator;
    MockV3Aggregator secondSuperAggregator;
    MarketConfiguration.Data superMarketConfig;
    MarketConfiguration.Data ethMarketConfig;
    MarketConfiguration.Data btcMarketConfig;
    CollateralConfiguration.Data collateralConfig;

    uint128 alice; // Account ID for Alice
    uint128 bob; // Account ID for Bob

    uint128 constant poolId = 1;
    uint128 constant superMarketId = 1;
    uint128 constant ethMarketId = 2;
    uint128 constant btcMarketId = 3;
    uint128 constant collateralId = 0;

    function setUp() public virtual {
        CannonDeploy deployer = new CannonDeploy();
        deployer.run();

        perps = IPerpsMarketProxy(deployer.getAddress("PerpsMarketProxy"));
        core = IV3CoreProxy(deployer.getAddress("v3.CoreProxy"));
        accountNft = IERC721(deployer.getAddress("v3.AccountProxy"));
        oracleManager = IOracleManagerProxy(deployer.getAddress("v3.oracle_manager.Proxy"));
        usdToken = IERC20(deployer.getAddress("v3.USDProxy"));
        collateralToken = CollateralMock(deployer.getAddress("v3.CollateralMock"));
        vm.label(address(perps), "PerpsMarketProxy");
        vm.label(address(core), "v3.CoreProxy");
        vm.label(address(accountNft), "v3.AccountProxy");
        vm.label(address(oracleManager), "v3.oracle_manager.Proxy");
        vm.label(address(usdToken), "v3.USDProxy");
        vm.label(address(collateralToken), "v3.CollateralMock");

        vm.prank(core.owner());
        core.createPool(poolId, core.owner());

        vm.startPrank(perps.owner());
        perps.createMarket({
            requestedMarketId: ethMarketId,
            marketName: "Ether",
            marketSymbol: "ETHPERP"
        });
        perps.createMarket({
            requestedMarketId: btcMarketId,
            marketName: "Bitcoin",
            marketSymbol: "BTCPERP"
        });

        // Register oracle nodes for the perps markets
        bytes32[] memory parents = new bytes32[](0);
        
        // Ensure we have properly initialized aggregators
        ethMockAggregator = new MockV3Aggregator();
        ethMockAggregator.mockSetCurrentPrice(2400e18, 18);
        
        superMockAggregator = new MockV3Aggregator();
        superMockAggregator.mockSetCurrentPrice(1e18, 18);
        
        secondSuperAggregator = new MockV3Aggregator();
        secondSuperAggregator.mockSetCurrentPrice(1e18, 18);
        
        // Register nodes using the correct oracleManager reference
        bytes32 ethOracleNodeId = NodeModule(address(oracleManager)).registerNode(
            NodeDefinition.NodeType.CHAINLINK,
            abi.encode(address(ethMockAggregator), uint256(0), uint8(18)),
            parents
        );
        perps.updatePriceData(ethMarketId, ethOracleNodeId, 0);
        
        bytes32 superOracleNodeId = NodeModule(address(oracleManager)).registerNode(
            NodeDefinition.NodeType.CHAINLINK,
            abi.encode(address(superMockAggregator), uint256(0), uint8(18)),
            parents
        );
        perps.updatePriceData(superMarketId, superOracleNodeId, 0);

        bytes32 btcOracleNodeId = NodeModule(address(oracleManager)).registerNode(
            NodeDefinition.NodeType.CHAINLINK,
            abi.encode(address(secondSuperAggregator), uint256(0), uint8(18)),
            parents
        );
        perps.updatePriceData(btcMarketId, btcOracleNodeId, 0);
        
        // Allow SNX-USD collateral (id 0) for margin by setting a large max amount and no discount
        ICollateralConfigurationModule(address(perps)).setCollateralConfiguration({
            collateralId: collateralId,
            maxCollateralAmount: type(uint256).max,
            upperLimitDiscount: 1e18,
            lowerLimitDiscount: 1e18,
            discountScalar: 1e18
        });
        
        // Cap accounts to at most one collateral type but unlimited positions
        IGlobalPerpsMarketModule(address(perps)).setPerAccountCaps({
            maxPositionsPerAccount: type(uint128).max,
            maxCollateralsPerAccount: 1
        });
        
        // Set up the perps market configuration
        // perps.setPerpsMarketId(superMarketId);
        
        // vm.stopPrank();

        // Configure the zero node separately
        // vm.startPrank(oracleManager.owner());
        bytes32 zeroNodeId = NodeModule(address(oracleManager)).registerNode(
            NodeDefinition.NodeType.CONSTANT,
            abi.encode(0),
            parents
        );
        vm.stopPrank();

        superMarketConfig = MarketConfiguration.Data({
            marketId: superMarketId,
            weightD18: 1,
            maxDebtShareValueD18: type(int128).max
        });
        MarketConfiguration.Data[] memory marketConfigs = new MarketConfiguration.Data[](1);
        marketConfigs[0] = superMarketConfig;

        vm.startPrank(core.owner());
        core.setPoolConfiguration(poolId, marketConfigs);

        // Set keeper cost node id to the previously registered zero constant node
        IGlobalPerpsMarketModule(address(perps)).updateKeeperCostNodeId(zeroNodeId);

        perps.setFeatureFlagAllowAll("createAccount", true);

        mockAggregator = new MockV3Aggregator();
        mockAggregator.mockSetCurrentPrice(1e18, 18);

        core.configureCollateral(
            CollateralConfiguration.Data({
                depositingEnabled: true,
                issuanceRatioD18: 5e18,
                liquidationRatioD18: 1.01e18,
                liquidationRewardD18: 0,
                // const one oracle id (later replace with a better source for the constant)
                oracleNodeId: NodeModule(address(oracleManager)).registerNode(
                    NodeDefinition.NodeType.CHAINLINK,
                    abi.encode(address(mockAggregator), uint256(0), uint8(18)),
                    parents
                ),
                tokenAddress: address(collateralToken),
                minDelegationD18: 0
            })
        );

        core.configureMaximumMarketCollateral(
            ethMarketId,
            address(collateralToken),
            type(uint256).max
        );
        collateralConfig = core.getCollateralConfiguration(address(collateralToken));
        vm.stopPrank();

        console.log("finish initial setup");

        vm.label(trader1, "trader1Alice");
        vm.label(trader2, "trader2Bob");
        vm.label(whale, "whaleTrader");


        // Setup traders

        _lpWhale();

        vm.prank(trader1);
        alice = core.createAccount();
        vm.prank(trader2);
        bob = core.createAccount();

        _dealTraderFunds(trader1, alice);
        _dealTraderFunds(trader2, bob);
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

    function _lpWhale() internal {
        vm.startPrank(whale);
        collateralToken.mint(whale, 150_000_000e18);
        uint128 whaleAccountId = core.createAccount();

        collateralToken.approve(address(core), 50_000_000e18);

        core.deposit(whaleAccountId, address(collateralToken), 50_000_000e18);

        core.delegateCollateral(
            whaleAccountId,
            poolId,
            address(collateralToken),
            50_000_000e18,
            1e18
        );
        uint128 whalePerpsAccountId = perps.createAccount();
        perps.setBookMode(whalePerpsAccountId, true);

        collateralToken.approve(address(perps), 50_000_000e18);

        console.log("whaleAccountId", whaleAccountId);
        console.log("whalePerpsAccountId", whalePerpsAccountId);

        console.log("perps.owner()", perps.owner());
        console.log("msg.sender ", msg.sender);
        console.log("perpsProxyAddress", address(perps));
        // console.log("perpsMarketId", perps.perpsMarketId());
        console.log("perps super market", core.getMarketAddress(superMarketId));

        collateralToken.approve(address(perps), 50_000_000e18);
        usdToken.approve(address(perps), 50_000_000e18);

        console.log("Collateral Token address", address(collateralToken));
        console.log("USD Token address", address(usdToken));
        console.log("Whale sUSD balance before deposit", usdToken.balanceOf(whale));
        console.log("Whale collateralToken balance", collateralToken.balanceOf(whale));

        core.mintUsd(whalePerpsAccountId, poolId, address(collateralToken), 10_000_000e18);
        console.log("Whale sUSD balance after mint", usdToken.balanceOf(whale));

        core.withdraw(whalePerpsAccountId, address(usdToken), 10_000_000e18);
        console.log(
            "Whale collateralToken balance after withdraw",
            collateralToken.balanceOf(whale)
        );
        console.log("Whale sUSD balance after withdraw", usdToken.balanceOf(whale));
        perps.modifyCollateral(whalePerpsAccountId, collateralId, 10_000_000e18);
        console.log(
            "Whale collateralToken balance after modifyCollateral",
            collateralToken.balanceOf(whale)
        );
        console.log("Whale sUSD balance after modifyCollateral", usdToken.balanceOf(whale));
        console.log("finish lp whale setup 50M collateral");
        vm.stopPrank();
    }

    function _dealTraderFunds(address trader, uint128 accountIdToUse) internal {
        vm.startPrank(trader);

        // Mint mock collateral to the trader
        collateralToken.mint(trader, 2_000_000e18);

        // Approve CoreProxy to spend mock collateral
        collateralToken.approve(address(core), 2_000_000e18);

        core.deposit(accountIdToUse, address(collateralToken), 1_000_000e18);

        // Delegate collateral to the specified pool
        core.delegateCollateral(accountIdToUse, poolId, address(collateralToken), 800_000e18, 1e18);

        // Mint sUSD against the collateral in the specified pool
        NodeOutput.Data memory nodeOutput = oracleManager.process(collateralConfig.oracleNodeId);
        int256 collateralPrice = nodeOutput.price;
        uint256 sUSDToMint = (800_000e18 * uint256(collateralPrice)) /
            collateralConfig.issuanceRatioD18;

        console.log("collateralPrice", collateralPrice);
        console.log("issuanceRatioD18", collateralConfig.issuanceRatioD18);
        console.log("sUSDToMint", sUSDToMint);
        core.mintUsd(accountIdToUse, poolId, address(collateralToken), sUSDToMint);

        // Withdraw minted sUSD to the trader's wallet
        core.withdraw(accountIdToUse, address(usdToken), sUSDToMint);

        console.log("finish minting sUSD");
        vm.stopPrank();
    }
}
