//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

/// @title Module for ERC721-compatible account tokens
interface IAccountTokenModule is INftModule {
    /// @notice Mints a new token with the `requestedAccountId` id owned by `owner`
    function mint(address owner, uint requestedAccountId) external;
}
