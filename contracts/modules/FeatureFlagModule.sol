//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {FeatureFlagModule as BaseFeatureFlagModule} from "@synthetixio/core-modules/contracts/modules/FeatureFlagModule.sol";
import {IFeatureFlagModule} from "../interfaces/IFeatureFlagModule.sol";
import {IFeatureFlagModule as IBaseFeatureFlagModule} from "@synthetixio/core-modules/contracts/interfaces/IFeatureFlagModule.sol";

import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Flags} from "../utils/Flags.sol";

contract FeatureFlagModule is BaseFeatureFlagModule {
    using FeatureFlag for FeatureFlag.Data;

    // TODO remove this when this method is implemented in @synthetixio/core-modules/contracts/storage/FeatureFlag.sol
    function _setFeatureFlagAllowAll(bytes32 feature, bool allowAll) internal {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).allowAll = allowAll;

        if (allowAll) {
            FeatureFlag.load(feature).denyAll = false;
        }

        emit IBaseFeatureFlagModule.FeatureFlagAllowAllSet(feature, allowAll);
    }

    // TODO remove this when this method is implemented in @synthetixio/core-modules/contracts/storage/FeatureFlag.sol
    function _setFeatureFlagDenyAll(bytes32 feature, bool denyAll) internal {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        if (!denyAll || !flag.isDenier(msg.sender)) {
            OwnableStorage.onlyOwner();
        }

        flag.denyAll = denyAll;

        emit FeatureFlagDenyAllSet(feature, denyAll);
    }

    function suspendAllFeatures() external {
        OwnableStorage.onlyOwner();
        _setFeatureFlagDenyAll(Flags.CREATE_ACCOUNT, true);
        _setFeatureFlagDenyAll(Flags.DEPOSIT, true);
        _setFeatureFlagDenyAll(Flags.WITHDRAW, true);
        _setFeatureFlagDenyAll(Flags.COMMIT_ORDER, true);
        _setFeatureFlagDenyAll(Flags.SETTLE_ORDER, true);
        _setFeatureFlagDenyAll(Flags.CANCEL_ORDER, true);
        _setFeatureFlagDenyAll(Flags.FLAG_POSITION, true);
        _setFeatureFlagDenyAll(Flags.LIQUIDATE_POSITION, true);
    }

    function enableAllFeatures() external {
        OwnableStorage.onlyOwner();
        _setFeatureFlagAllowAll(Flags.CREATE_ACCOUNT, true);
        _setFeatureFlagAllowAll(Flags.DEPOSIT, true);
        _setFeatureFlagAllowAll(Flags.WITHDRAW, true);
        _setFeatureFlagAllowAll(Flags.COMMIT_ORDER, true);
        _setFeatureFlagAllowAll(Flags.SETTLE_ORDER, true);
        _setFeatureFlagAllowAll(Flags.CANCEL_ORDER, true);
        _setFeatureFlagAllowAll(Flags.FLAG_POSITION, true);
        _setFeatureFlagAllowAll(Flags.LIQUIDATE_POSITION, true);
    }
}
