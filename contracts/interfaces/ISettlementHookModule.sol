//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

interface ISettlementHookConfigurationModule {
    // --- Structs --- //

    // @notice See SettlementHookConfiguration.GlobalData for more details.
    struct ConfigureParameters {
        address[] whitelistedHookAddresses;
        uint32 maxHooksPerOrderCommit;
    }

    // --- Events --- //

    // @notice Emitted when an order is settled with a specified hook.
    event SettlementHookInvoked(uint128 indexed accountId, uint128 marketId, address hook);

    // --- Mutative --- //

    /**
     * @notice Configures settlement hook parameters applied globally.
     */
    function setSettlementHookConfiguration(
        ISettlementHookConfigurationModule.ConfigureParameters memory data
    ) external;

    // --- Views --- //

    /**
     * @notice Returns configured global settlement hook parameters.
     */
    function getSettlementHookConfiguration() external pure returns (ConfigureParameters memory);

    /**
     * @notice Returns whether the specified hook is whitelisted.
     */
    function isSettlementHookWhitelsited(address hook) external returns (bool);
}
