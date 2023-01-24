//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IERC721Receiver.sol";
import "../../interfaces/IERC721.sol";

contract ERC721ReceiverMock is IERC721Receiver {
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function transferToken(address nftAddress, address to, uint256 tokenId) public {
        IERC721(nftAddress).transferFrom(address(this), to, tokenId);
    }
}
