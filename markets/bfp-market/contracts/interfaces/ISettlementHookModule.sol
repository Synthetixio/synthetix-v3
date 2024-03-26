//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

interface ISettlementHookModule {
    // --- Structs --- //

    /// @notice See SettlementHookConfiguration.GlobalData for more details.
    struct SettlementHookConfigureParameters {
        address[] whitelistedHookAddresses;
        uint32 maxHooksPerOrder;
    }

    // --- Events --- //

    /// @notice Emitted when hooks are configured.
    /// @param from Address of hook configurer
    /// @param hooks Number of hooks configured
    event SettlementHookConfigured(address indexed from, uint256 hooks);

    // --- Mutations --- //

    /// @notice Configures settlement hook parameters applied globally.
    /// @param data A struct of parameters to configure with
    function setSettlementHookConfiguration(
        ISettlementHookModule.SettlementHookConfigureParameters memory data
    ) external;

    // --- Views --- //

    /// @notice Returns configured global settlement hook parameters.
    /// @return getSettlementHookConfiguration A struct of `SettlementHookConfigureParameters` used for configuration
    function getSettlementHookConfiguration()
        external
        view
        returns (ISettlementHookModule.SettlementHookConfigureParameters memory);

    /// @notice Returns whether the specified hook is whitelisted.
    /// @param hook Address of hook to assert
    /// @return isSettlementHookWhitelisted True if whitelisted, false otherwise
    function isSettlementHookWhitelisted(address hook) external view returns (bool);
}
