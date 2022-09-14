//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/ERC721Owned.sol";

contract ERC721OwnedMock is ERC721Owned {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory baseURL
    ) public {
        _initialize(tokenName, tokenSymbol, baseURL);
    }

    function mint(uint256 tokenId) external {
        _mint(msg.sender, tokenId);
    }

    function mintTo(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
