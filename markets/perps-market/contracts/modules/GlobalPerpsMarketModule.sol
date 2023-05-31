//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

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
    function setMaxCollateralForSynthMarketId(
        uint128 synthMarketId,
        uint collateralAmount
    ) external {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxCollateralAmounts[synthMarketId] = collateralAmount;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setSynthDeductionPriorty(uint128[] memory newSynthDeductionPriority) external {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.synthDeductionPriority = newSynthDeductionPriority;
    }
}
