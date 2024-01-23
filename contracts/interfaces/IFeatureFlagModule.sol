//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import {IFeatureFlagModule as IBaseFeatureFlagModule} from "@synthetixio/core-modules/contracts/interfaces/IFeatureFlagModule.sol";

interface IFeatureFlagModule is IBaseFeatureFlagModule {
    function suspendAllFeatures() external;

    function enableAllFeatures() external;
}
