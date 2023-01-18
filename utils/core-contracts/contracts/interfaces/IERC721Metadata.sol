//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./IERC165.sol";

/**
 * @title Additional metadata for IERC721 tokens.
 */
interface IERC721Metadata is IERC165 {
    /**
     * @notice Retrieves the name of the token, e.g. "Synthetix Account Token".
     * @return A string with the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @notice Retrieves the symbol of the token, e.g. "SNX-ACC".
     * @return A string with the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @notice Retrieves the off-chain URI where the specified token id may contain associated data, such as images, audio, etc.
     * @param tokenId The numeric id of the token in question.
     * @return The URI of the token in question.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
