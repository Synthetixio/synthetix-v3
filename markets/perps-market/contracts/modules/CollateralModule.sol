//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ICollateralModule} from "../interfaces/ICollateralModule.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";

contract CollateralModule is ICollateralModule {
    function setMaxCollateralAmount(uint128 synthId, uint maxCollateralAmount) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.load().maxCollateralAmounts[synthId] = maxCollateralAmount;

        emit MaxCollateralSet(synthId, maxCollateralAmount);
    }
}
