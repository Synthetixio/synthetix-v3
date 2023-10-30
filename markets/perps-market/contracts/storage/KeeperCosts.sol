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
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;

    uint256 private constant KIND_SETTLEMENT = 0;
    uint256 private constant KIND_LIQUIDATION_ELIGIBILITY = 1;
    uint256 private constant KIND_FLAG = 2;
    uint256 private constant KIND_LIQUIDATE = 3;

    struct Data {
        bytes32 feedId;
    }

    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.KeeperCosts", marketId));
        assembly {
            price.slot := s
        }
    }

    function update(Data storage self, bytes32 feedId) internal {
        self.feedId = feedId;
    }

    function getSettlementKeeperCosts(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        accountId; // unused for now, but will be used to calculate rewards based on account collaterals in the future

        (bytes32[] memory runtimeKeys, bytes32[] memory runtimeValues) = getRuntime(
            0,
            0,
            0,
            KIND_SETTLEMENT
        );

        sUSDCost = INodeModule(factory.oracle)
            .processWithRuntime(self.feedId, runtimeKeys, runtimeValues)
            .price
            .toUint();
    }

    function getFlagKeeperCosts(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        uint numberOfUpdatedFeeds = account.activeCollateralTypes.length() +
            account.openPositionMarketIds.length();

        (bytes32[] memory runtimeKeys, bytes32[] memory runtimeValues) = getRuntime(
            0,
            0,
            numberOfUpdatedFeeds,
            KIND_FLAG
        );

        sUSDCost = INodeModule(factory.oracle)
            .processWithRuntime(self.feedId, runtimeKeys, runtimeValues)
            .price
            .toUint();
    }

    function getLiquidateKeeperCosts(Data storage self) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        (bytes32[] memory runtimeKeys, bytes32[] memory runtimeValues) = getRuntime(
            0,
            0,
            0,
            KIND_LIQUIDATE
        );

        sUSDCost = INodeModule(factory.oracle)
            .processWithRuntime(self.feedId, runtimeKeys, runtimeValues)
            .price
            .toUint();
    }

    function getTotalKeeperCosts(
        Data storage self,
        uint128 accountId,
        uint128 marketId,
        int256 positionSize
    ) internal view returns (uint sUSDCost) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        uint numberOfUpdatedFeeds = account.activeCollateralTypes.length() +
            account.openPositionMarketIds.length();

        uint256 rateLimit = PerpsMarketConfiguration.load(marketId).maxLiquidationAmountInWindow();

        (bytes32[] memory runtimeKeys, bytes32[] memory runtimeValues) = getRuntime(
            positionSize.toUint(),
            rateLimit,
            numberOfUpdatedFeeds,
            KIND_LIQUIDATION_ELIGIBILITY
        );

        sUSDCost = INodeModule(factory.oracle)
            .processWithRuntime(self.feedId, runtimeKeys, runtimeValues)
            .price
            .toUint();
    }

    function getRuntime(
        uint256 positionSize,
        uint256 rateLimit,
        uint256 numberOfUpdatedFeeds,
        uint256 executionKind
    ) private pure returns (bytes32[] memory runtimeKeys, bytes32[] memory runtimeValues) {
        runtimeKeys = new bytes32[](4);
        runtimeValues = new bytes32[](4);
        runtimeKeys[0] = bytes32("positionSize");
        runtimeKeys[1] = bytes32("rateLimit");
        runtimeKeys[2] = bytes32("numberOfUpdatedFeeds");
        runtimeKeys[3] = bytes32("executionKind");
        runtimeValues[0] = bytes32(positionSize);
        runtimeValues[1] = bytes32(rateLimit);
        runtimeValues[2] = bytes32(numberOfUpdatedFeeds);
        runtimeValues[3] = bytes32(executionKind);
    }
}
