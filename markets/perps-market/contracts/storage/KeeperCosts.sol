//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";

/**
 * @title Keeper txn execution costs for rewards calculation based on gas price
 */
library KeeperCosts {
    using SafeCastI256 for int256;
    using SetUtil for SetUtil.UintSet;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;

    uint256 private constant KIND_SETTLEMENT = 0;
    uint256 private constant KIND_LIQUIDATION_ELIGIBILITY = 1;
    uint256 private constant KIND_FLAG = 2;
    uint256 private constant KIND_LIQUIDATE = 3;

    struct Data {
        bytes32 keeperCostNodeId;
    }

    function load() internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.KeeperCosts"));
        assembly {
            price.slot := s
        }
    }

    function update(Data storage self, bytes32 keeperCostNodeId) internal {
        self.keeperCostNodeId = keeperCostNodeId;
    }

    function getSettlementKeeperCosts(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        accountId; // unused for now, but will be used to calculate rewards based on account collaterals in the future

        sUSDCost = _processWithRuntime(self.keeperCostNodeId, factory, 0, 0, KIND_SETTLEMENT);
    }

    function getFlagKeeperCosts(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        uint numberOfUpdatedFeeds = account.getNumberOfCollaterals(false) +
            account.openPositionMarketIds.length();

        sUSDCost = _processWithRuntime(
            self.keeperCostNodeId,
            factory,
            0,
            numberOfUpdatedFeeds,
            KIND_FLAG
        );
    }

    function getLiquidateKeeperCosts(Data storage self) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        sUSDCost = _processWithRuntime(self.keeperCostNodeId, factory, 0, 0, KIND_LIQUIDATE);
    }

    function getTotalFlagAndLiquidationCost(
        Data storage self,
        uint128 accountId,
        uint256 numberOfChunks
    ) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        uint numberOfUpdatedFeeds = account.activeCollateralTypes.length() +
            account.openPositionMarketIds.length();

        sUSDCost = _processWithRuntime(
            self.keeperCostNodeId,
            factory,
            numberOfChunks,
            numberOfUpdatedFeeds,
            KIND_LIQUIDATION_ELIGIBILITY
        );
    }

    function _processWithRuntime(
        bytes32 keeperCostNodeId,
        PerpsMarketFactory.Data storage factory,
        uint256 numberOfChunks,
        uint256 numberOfUpdatedFeeds,
        uint256 executionKind
    ) private view returns (uint sUSDCost) {
        bytes32[] memory runtimeKeys = new bytes32[](4);
        bytes32[] memory runtimeValues = new bytes32[](4);
        runtimeKeys[0] = bytes32("numberOfChunks");
        runtimeKeys[1] = bytes32("numberOfUpdatedFeeds");
        runtimeKeys[2] = bytes32("executionKind");
        runtimeValues[0] = bytes32(numberOfChunks);
        runtimeValues[1] = bytes32(numberOfUpdatedFeeds);
        runtimeValues[2] = bytes32(executionKind);

        sUSDCost = INodeModule(factory.oracle)
            .processWithRuntime(keeperCostNodeId, runtimeKeys, runtimeValues)
            .price
            .toUint();
    }
}
