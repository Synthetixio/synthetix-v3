//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {FeatureFlagModule as BaseFeatureFlagModule} from "@synthetixio/core-modules/contracts/modules/FeatureFlagModule.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IFeatureFlagModule} from "../interfaces/IFeatureFlagModule.sol";
import {Flags} from "../utils/Flags.sol";

contract FeatureFlagModule is IFeatureFlagModule, BaseFeatureFlagModule {
    using FeatureFlag for FeatureFlag.Data;

    // --- Helpers --- //

    /// @dev Allow all addresses to use a feature.
    function enableFeature(bytes32 feature) internal {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        flag.allowAll = true;
        flag.denyAll = false;
    }

    /// @dev Deny all addresses to use a feature. This can be called by a "denier" or the owner.
    function suspendFeature(bytes32 feature) internal {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        if (!flag.isDenier(ERC2771Context._msgSender())) {
            OwnableStorage.onlyOwner();
        }

        flag.denyAll = true;
    }

    /// @inheritdoc IFeatureFlagModule
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
        suspendFeature(Flags.MERGE_ACCOUNT);
        suspendFeature(Flags.SPLIT_ACCOUNT);

        emit PerpMarketSuspended(true);
    }

    /// @inheritdoc IFeatureFlagModule
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
        enableFeature(Flags.MERGE_ACCOUNT);
        enableFeature(Flags.SPLIT_ACCOUNT);

        emit PerpMarketSuspended(false);
    }
}
