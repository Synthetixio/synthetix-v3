//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

/**
 * @title Module with custom NFT logic for the async order claim token
 */
interface IAsyncOrderClaimTokenModule is INftModule {
    /**
     * @notice Emitted when `tokenId` token is minted.
     * @param owner The owner of the newly minted token.
     * @param tokenId The id of the newly minted token.
     */
    event Mint(address indexed owner, uint256 indexed tokenId);

    /**
     * @notice Emitted when `tokenId` token is burned.
     * @param tokenId The id of the burned token.
     */
    event Burn(uint256 indexed tokenId);

    /**
     * @notice Mints a new token with the next available ID, owned by `owner`.
     * @param owner The address that will own the new token.
     * @return id The id of the minted token.
     *
     * This function is only used internally by the system. See `commitBuyOrder` and `commitSellOrder` in the Async Order Module.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the contract.
     *
     * Emits a {Mint} event.
     */
    function mint(address owner) external returns (uint256 id);

    /**
     * @notice Burns a token with the specified ID
     * @param id The id of the token that will be burned
     *
     * This function is only used internally by the system. See `settleOrder` and `cancelOrder` in the Async Order Module.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the contract.
     *
     * Emits a {Burn} event.
     */
    function burn(uint256 id) external;
}
