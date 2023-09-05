//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title ERC721 extension that allows contracts to receive tokens with `safeTransferFrom`.
 */
interface IERC721Receiver {
    /**
     * @notice Function that will be called by ERC721 tokens implementing the `safeTransferFrom` function.
     * @dev The contract transferring the token will revert if the receiving contract does not implement this function.
     * @param operator The address that is executing the transfer.
     * @param from The address whose token is being transferred.
     * @param tokenId The numeric id of the token being transferred.
     * @param data Optional additional data that may be passed by the operator, and could be used by the implementing contract.
     * @return The selector of this function (IERC721Receiver.onERC721Received.selector). Caller will revert if not returned.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes memory data
    ) external returns (bytes4);
}
