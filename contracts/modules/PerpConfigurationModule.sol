//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../interfaces/IPerpConfigurationModule.sol";

contract PerpConfigurationModule is IPerpConfigurationModule {
    /**
     * @inheritdoc IPerpConfigurationModule
     */
    function configure(uint128 marketId, IPerpConfigurationModule.ConfigureByMarketParameters memory data) external {
        OwnableStorage.onlyOwner();
    }

    /**
     * @inheritdoc IPerpConfigurationModule
     */
    function configure(IPerpConfigurationModule.ConfigureParameters memory data) external {
        OwnableStorage.onlyOwner();
    }
}
