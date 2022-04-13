//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IAccountModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeAccountModule(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external;

    function isAccountModuleInitialized() external view returns (bool);
}
