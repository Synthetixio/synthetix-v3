//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

contract GlobalPerpsMarketModule is IGlobalPerpsMarketModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;

    function setMaxCollateralAmount(
        uint128 synthMarketId,
        uint collateralAmount
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxCollateralAmounts[synthMarketId] = collateralAmount;

        emit MaxCollateralAmountSet(synthMarketId, collateralAmount);
    }

    function getMaxCollateralAmount(uint128 synthMarketId) external view override returns (uint) {
        return GlobalPerpsMarketConfiguration.load().maxCollateralAmounts[synthMarketId];
    }

    function setSynthDeductionPriority(
        uint128[] memory newSynthDeductionPriority
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.synthDeductionPriority = newSynthDeductionPriority;

        emit SynthDeductionPrioritySet(newSynthDeductionPriority);
    }

    function getSynthDeductionPriority() external view override returns (uint128[] memory) {
        return GlobalPerpsMarketConfiguration.load().synthDeductionPriority;
    }

    function setLiquidationRewardGuards(
        uint256 minLiquidationRewardUsd,
        uint256 maxLiquidationRewardUsd
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.minLiquidationRewardUsd = minLiquidationRewardUsd;
        store.maxLiquidationRewardUsd = maxLiquidationRewardUsd;

        emit LiquidationRewardGuardsSet(minLiquidationRewardUsd, maxLiquidationRewardUsd);
    }

    function getLiquidationRewardGuards()
        external
        view
        override
        returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        minLiquidationRewardUsd = store.minLiquidationRewardUsd;
        maxLiquidationRewardUsd = store.maxLiquidationRewardUsd;
    }
}
