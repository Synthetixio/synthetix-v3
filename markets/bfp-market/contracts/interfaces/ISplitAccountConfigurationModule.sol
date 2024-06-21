//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

interface ISplitAccountConfigurationModule {
    // --- Events --- //

    /// @notice Emitted when split account whitelist is configured.
    /// @param from Address of configurer
    /// @param hooks Number of addresses configured
    event SplitAccountConfigured(address indexed from, uint256 hooks);

    // --- Mutations --- //

    /// @notice Configures a list of addresses to be whitelisted for splitAccount.
    /// @param addresses An array of addresses to whitelist
    function setEndorsedSplitAccounts(address[] memory addresses) external;

    // --- Views --- //

    /// @notice Returns addresses allowed to split account.
    /// @return addresses list of addresses
    function getEndorsedSplitAccounts() external view returns (address[] memory addresses);

    /// @notice Returns whether the specified hook is whitelisted.
    /// @param addr Address of hook to assert
    /// @return isEndoresedForSplitAccount True if whitelisted, false otherwise
    function isEndorsedForSplitAccount(address addr) external view returns (bool);
}
