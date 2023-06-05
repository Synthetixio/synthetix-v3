//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

contract GlobalPerpsMarketModule is IGlobalPerpsMarketModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;

    function getMaxCollateralAmountsForSynthMarket(
        uint128 synthMarketId
    ) external view override returns (uint) {
        return GlobalPerpsMarketConfiguration.load().maxCollateralAmounts[synthMarketId];
    }

    function getSynthDeductionPriorty() external view override returns (uint128[] memory) {
        return GlobalPerpsMarketConfiguration.load().synthDeductionPriority;
    }

    function getMinLiquidationRewardUsd() external view returns (uint256) {
        return GlobalPerpsMarketConfiguration.load().minLiquidationRewardUsd;
    }

    function getMaxLiquidationRewardUsd() external view returns (uint256) {
        return GlobalPerpsMarketConfiguration.load().maxLiquidationRewardUsd;
    }

    function setMaxCollateralForSynthMarketId(
        uint128 synthMarketId,
        uint collateralAmount
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxCollateralAmounts[synthMarketId] = collateralAmount;
    }

    function setSynthDeductionPriorty(
        uint128[] memory newSynthDeductionPriority
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.synthDeductionPriority = newSynthDeductionPriority;
    }

    function setMinLiquidationRewardUsd(uint256 minLiquidationRewardUsd) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.minLiquidationRewardUsd = minLiquidationRewardUsd;
    }

    function setMaxLiquidationRewardUsd(uint256 maxLiquidationRewardUsd) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxLiquidationRewardUsd = maxLiquidationRewardUsd;
    }
}
