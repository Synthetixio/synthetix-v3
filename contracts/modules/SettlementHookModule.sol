//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ISettlementHookModule} from "../interfaces/ISettlementHookModule.sol";
import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

contract SettlementHookModule is ISettlementHookModule {
    // --- Mutative --- //

    /**
     * @inheritdoc ISettlementHookModule
     */
    function setSettlementHookConfiguration(ISettlementHookModule.ConfigureParameters memory data) external {
        OwnableStorage.onlyOwner();

        SettlementHookConfiguration.GlobalData storage config = SettlementHookConfiguration.load();

        uint256 hooksLengthBefore = config.whitelistedHookAddresses.length;
        uint256 hooksLengthAfter = data.whitelistedHookAddresses.length;

        // Clear existing hooks to be replaced with new.
        for (uint256 i = 0; i < hooksLengthBefore; ) {
            delete config.whitelisted[config.whitelistedHookAddresses[i]];
            unchecked {
                ++i;
            }
        }
        delete config.whitelistedHookAddresses;

        // Update with passed in configuration.
        for (uint256 i = 0; i < hooksLengthAfter; ) {
            config.whitelisted[data.whitelistedHookAddresses[i]] = true;
            unchecked {
                ++i;
            }
        }
        config.whitelistedHookAddresses = data.whitelistedHookAddresses;
        config.maxHooksPerOrderCommit = data.maxHooksPerOrderCommit;

        emit SettlementHookConfigured(msg.sender, hooksLengthAfter);
    }

    // --- Views --- //

    /**
     * @inheritdoc ISettlementHookModule
     */
    function getSettlementHookConfiguration() external view returns (ISettlementHookModule.ConfigureParameters memory) {
        SettlementHookConfiguration.GlobalData storage d = SettlementHookConfiguration.load();
        return ISettlementHookModule.ConfigureParameters(d.whitelistedHookAddresses, d.maxHooksPerOrderCommit);
    }

    /**
     * @inheritdoc ISettlementHookModule
     */
    function isSettlementHookWhitelisted(address hook) external view returns (bool) {
        SettlementHookConfiguration.GlobalData storage d = SettlementHookConfiguration.load();
        return d.whitelisted[hook];
    }
}
