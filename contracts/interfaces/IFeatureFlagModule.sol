//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import {IFeatureFlagModule as IBaseFeatureFlagModule} from "@synthetixio/core-modules/contracts/interfaces/IFeatureFlagModule.sol";

interface IFeatureFlagModule is IBaseFeatureFlagModule {
    // @notice Emitted when all features get suspended or enabled.
    event PerpMarketSuspended(bool suspended);

    // @notice Suspends all features. Can be called by owner or a configured "denier"
    function suspendAllFeatures() external;

    // @notice Enable all features. Can be called by owner
    function enableAllFeatures() external;
}
