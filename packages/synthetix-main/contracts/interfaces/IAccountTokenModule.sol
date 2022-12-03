//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

/**
 * @title Module with custom NFT logic for the account token.
 */
interface IAccountTokenModule is INftModule {
    /**
     * @notice Emitted when `tokenId` token is minted.
     */
    event Mint(address indexed owner, uint256 indexed tokenId);

    /**
     * @notice Mints a new token with the `requestedAccountId` as the ID, owned by `owner`
     *
     * This function is only used internally by the system. See `createAccount` in the Account Module.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the contract.
     * - `requestedAccountId` must not already be minted.
     *
     * Emits a {Mint} event.
     */
    function mint(address owner, uint requestedAccountId) external;
}
