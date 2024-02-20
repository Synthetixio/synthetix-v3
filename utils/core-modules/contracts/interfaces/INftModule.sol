//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC721Enumerable.sol";

/**
 * @title Module wrapping an ERC721 token implementation.
 */
interface INftModule is IERC721Enumerable {
    /**
     * @notice Returns whether the token has been initialized.
     * @return A boolean with the result of the query.
     */
    function isInitialized() external view returns (bool);

    /**
     * @notice Initializes the token with name, symbol, and uri.
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external;

    /**
     * @notice Allows the owner to mint tokens.
     * @param to The address to receive the newly minted tokens.
     * @param tokenId The ID of the newly minted token
     */
    function mint(address to, uint256 tokenId) external;

    /**
     * @notice Allows the owner to mint tokens. Verifies that the receiver can receive the token
     * @param to The address to receive the newly minted token.
     * @param tokenId The ID of the newly minted token
     * @param data any data which should be sent to the receiver
     */
    function safeMint(address to, uint256 tokenId, bytes memory data) external;

    /**
     * @notice Allows the owner to burn tokens.
     * @param tokenId The token to burn
     */
    function burn(uint256 tokenId) external;

    /**
     * @notice Allows an address that holds tokens to provide allowance to another.
     * @param tokenId The token which should be allowed to spender
     * @param spender The address that is given allowance.
     */
    function setAllowance(uint256 tokenId, address spender) external;

    /**
     * @notice Allows the owner to update the base token URI.
     * @param uri The new base token uri
     */
    function setBaseTokenURI(string memory uri) external;
}
