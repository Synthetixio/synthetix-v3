//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./ERC721.sol";
import "../ownership/Ownable.sol";

contract ERC721Owned is ERC721, Ownable {
    // solhint-disable-next-line no-empty-blocks
    constructor(address initialOwner) Ownable(initialOwner) {}

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override onlyOwner {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override onlyOwner {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public virtual override onlyOwner {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function _isApprovedOrOwner(address, uint256) internal view virtual override returns (bool) {
        // The owner (and only the owner) is authorized to transfer
        return (this.owner() == msg.sender);
    }
}
