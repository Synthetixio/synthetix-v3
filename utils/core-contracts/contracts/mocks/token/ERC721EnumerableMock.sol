//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../token/ERC721Enumerable.sol";

contract ERC721EnumerableMock is ERC721Enumerable {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory baseURL
    ) public {
        _initialize(tokenName, tokenSymbol, baseURL);
    }

    function mintTo(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }

    function transfer(address from, address to, uint256 tokenId) external {
        _transfer(from, to, tokenId);
    }
}
