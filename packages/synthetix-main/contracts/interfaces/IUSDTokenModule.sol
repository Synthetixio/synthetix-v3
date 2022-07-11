//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

/// @title Module for managing snxUSD token as a Satellite
interface IUSDTokenModule is ISatelliteFactory {
    /// @notice initializes the USD Token Module. Creates the first USD token implementation and takes ownership by the system
    function initializeUSDTokenModule() external;

    /// @notice shows whether the module has been initialized
    function isUSDTokenModuleInitialized() external view returns (bool);

    /// @notice upgrades the USDToken implementation.
    function upgradeUSDImplementation(address newUSDTokenImplementation) external;

    /// @notice gets the USDToken address.
    function getUSDTokenAddress() external view returns (address);

    /// @notice gets the USDToken Satellites created (only one, at idx 0).
    function getUSDTokenModuleSatellites() external view returns (Satellite[] memory);
}
