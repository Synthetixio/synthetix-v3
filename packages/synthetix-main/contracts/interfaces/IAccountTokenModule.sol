//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

/// @title Module for ERC721-compatible account tokens
interface IAccountTokenModule is INftModule {
    /**
     * @dev Emitted when `tokenId` token is minted.
     */
    event Mint(address indexed owner, uint256 indexed tokenId);

    /**
     * @dev Mints a new token with the `requestedAccountId` as the ID, owned by `owner`.
     *
     * Requirements:
     *
     * - `requestedAccountId` must not already be minted.
     *
     * Emits a {Mint} event.
     */
    function mint(address owner, uint requestedAccountId) external;
}
