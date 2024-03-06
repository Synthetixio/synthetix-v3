//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

interface ISettlementHookModule {
    // --- Structs --- //

    // @notice See SettlementHookConfiguration.GlobalData for more details.
    struct ConfigureParameters {
        address[] whitelistedHookAddresses;
        uint32 maxHooksPerOrder;
    }

    // --- Events --- //

    // @notice Emitted when hooks are configured.
    event SettlementHookConfigured(address indexed from, uint256 hooks);

    // --- Mutations --- //

    /**
     * @notice Configures settlement hook parameters applied globally.
     */
    function setSettlementHookConfiguration(
        ISettlementHookModule.ConfigureParameters memory data
    ) external;

    // --- Views --- //

    /**
     * @notice Returns configured global settlement hook parameters.
     */
    function getSettlementHookConfiguration()
        external
        view
        returns (ISettlementHookModule.ConfigureParameters memory);

    /**
     * @notice Returns whether the specified hook is whitelisted.
     */
    function isSettlementHookWhitelisted(address hook) external view returns (bool);
}
