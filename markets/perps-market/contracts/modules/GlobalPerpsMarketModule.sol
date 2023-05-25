//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";

contract GlobalPerpsMarketModule is IGlobalPerpsMarketModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getMaxCollateralAmountsForSynthMarket(
        uint128 synthMarketId
    ) external view returns (uint) {
        return GlobalPerpsMarketConfiguration.load().maxCollateralAmounts[synthMarketId];
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getSynthDeductionPriorty() external view returns (uint128[] memory) {
        return GlobalPerpsMarketConfiguration.load().synthDeductionPriority;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getMaxLeverage() external view returns (uint256) {
        return GlobalPerpsMarketConfiguration.load().maxLeverage;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setMaxCollateralForSynthMarketId(
        uint128 synthMarketId,
        uint collateralAmount
    ) external {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxCollateralAmounts[synthMarketId] = collateralAmount;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setSynthDeductionPriorty(uint128[] memory newSynthDeductionPriority) external {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.synthDeductionPriority = newSynthDeductionPriority;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setMaxLeverage(uint256 maxLeverage) external {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxLeverage = maxLeverage;
    }
}
