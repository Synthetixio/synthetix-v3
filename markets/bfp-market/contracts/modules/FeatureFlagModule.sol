//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {FeatureFlagModule as BaseFeatureFlagModule} from "@synthetixio/core-modules/contracts/modules/FeatureFlagModule.sol";
import {IFeatureFlagModule} from "../interfaces/IFeatureFlagModule.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Flags} from "../utils/Flags.sol";

contract FeatureFlagModule is IFeatureFlagModule, BaseFeatureFlagModule {
    using FeatureFlag for FeatureFlag.Data;

    /**
     * @dev Allow all addresses to use a feature.
     */
    function enableFeature(bytes32 feature) internal {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        flag.allowAll = true;
        flag.denyAll = false;
    }

    /**
     * @dev Deny all addresses to use a feature. This can be called by a "denier" or the owner.
     */
    function suspendFeature(bytes32 feature) internal {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        if (!flag.isDenier(msg.sender)) {
            OwnableStorage.onlyOwner();
        }

        flag.denyAll = true;
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function suspendAllFeatures() external {
        suspendFeature(Flags.CREATE_ACCOUNT);
        suspendFeature(Flags.DEPOSIT);
        suspendFeature(Flags.WITHDRAW);
        suspendFeature(Flags.COMMIT_ORDER);
        suspendFeature(Flags.SETTLE_ORDER);
        suspendFeature(Flags.CANCEL_ORDER);
        suspendFeature(Flags.FLAG_POSITION);
        suspendFeature(Flags.LIQUIDATE_POSITION);
        suspendFeature(Flags.PAY_DEBT);
        suspendFeature(Flags.LIQUIDATE_MARGIN_ONLY);

        emit PerpMarketSuspended(true);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function enableAllFeatures() external {
        OwnableStorage.onlyOwner();

        enableFeature(Flags.CREATE_ACCOUNT);
        enableFeature(Flags.DEPOSIT);
        enableFeature(Flags.WITHDRAW);
        enableFeature(Flags.COMMIT_ORDER);
        enableFeature(Flags.SETTLE_ORDER);
        enableFeature(Flags.CANCEL_ORDER);
        enableFeature(Flags.FLAG_POSITION);
        enableFeature(Flags.LIQUIDATE_POSITION);
        enableFeature(Flags.PAY_DEBT);
        enableFeature(Flags.LIQUIDATE_MARGIN_ONLY);

        emit PerpMarketSuspended(false);
    }
}
