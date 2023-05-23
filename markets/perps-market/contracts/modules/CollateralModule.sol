//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ICollateralModule} from "../interfaces/ICollateralModule.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";

contract CollateralModule is ICollateralModule {
    using PerpsMarketFactory for PerpsMarketFactory.Data;

    function setMaxCollateralAmount(uint128 synthId, uint maxCollateralAmount) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();
        perpsMarketFactory.maxCollateralAmounts[synthId] = maxCollateralAmount;

        // TODO: emit event
    }
}
