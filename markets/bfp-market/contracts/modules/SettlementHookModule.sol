//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ISettlementHookModule} from "../interfaces/ISettlementHookModule.sol";
import {ISettlementHook} from "../interfaces/hooks/ISettlementHook.sol";
import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

contract SettlementHookModule is ISettlementHookModule {
    // --- Mutations --- //

    /**
     * @inheritdoc ISettlementHookModule
     */
    function setSettlementHookConfiguration(
        ISettlementHookModule.SettlementHookConfigureParameters memory data
    ) external {
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
        address currentHook;

        for (uint256 i = 0; i < hooksLengthAfter; ) {
            currentHook = data.whitelistedHookAddresses[i];
            if (
                !ERC165Helper.safeSupportsInterface(currentHook, type(ISettlementHook).interfaceId)
            ) {
                revert ErrorUtil.InvalidHook(currentHook);
            }
            config.whitelisted[data.whitelistedHookAddresses[i]] = true;
            unchecked {
                ++i;
            }
        }
        config.whitelistedHookAddresses = data.whitelistedHookAddresses;
        config.maxHooksPerOrder = data.maxHooksPerOrder;

        emit SettlementHookConfigured(ERC2771Context._msgSender(), hooksLengthAfter);
    }

    // --- Views --- //

    /**
     * @inheritdoc ISettlementHookModule
     */
    function getSettlementHookConfiguration()
        external
        view
        returns (ISettlementHookModule.SettlementHookConfigureParameters memory)
    {
        SettlementHookConfiguration.GlobalData storage d = SettlementHookConfiguration.load();
        return
            ISettlementHookModule.SettlementHookConfigureParameters(
                d.whitelistedHookAddresses,
                d.maxHooksPerOrder
            );
    }

    /**
     * @inheritdoc ISettlementHookModule
     */
    function isSettlementHookWhitelisted(address hook) external view returns (bool) {
        SettlementHookConfiguration.GlobalData storage d = SettlementHookConfiguration.load();
        return d.whitelisted[hook];
    }
}
