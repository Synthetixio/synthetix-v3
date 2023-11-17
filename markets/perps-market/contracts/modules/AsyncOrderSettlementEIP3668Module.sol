//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {IAsyncOrderSettlementEIP3668Module} from "../interfaces/IAsyncOrderSettlementEIP3668Module.sol";
import {IAsyncOrderSettlementPythModule} from "../interfaces/IAsyncOrderSettlementPythModule.sol";
import {OffchainUtil} from "../utils/OffchainUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";

/**
 * @title Module for settling async orders via EIP-3668.
 * @dev See IAsyncOrderSettlementEIP3668Module.
 */
contract AsyncOrderSettlementEIP3668Module is IAsyncOrderSettlementEIP3668Module, IMarketEvents {
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;

    /**
     * @inheritdoc IAsyncOrderSettlementEIP3668Module
     */
    function settle(uint128 accountId) external view {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        GlobalPerpsMarket.load().checkLiquidation(accountId);
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        _settleOffchain(order, settlementStrategy);
    }

    /**
     * @dev used for settleing offchain orders. This will revert with OffchainLookup.
     */
    function _settleOffchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = IAsyncOrderSettlementPythModule.settlePythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        // see EIP-3668: https://eips.ethereum.org/EIPS/eip-3668
        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(
                settlementStrategy.feedId,
                OffchainUtil.getTimeInBytes(asyncOrder.settlementTime)
            ),
            selector,
            abi.encode(asyncOrder.request.accountId) // extraData that gets sent to callback for validation
        );
    }
}
