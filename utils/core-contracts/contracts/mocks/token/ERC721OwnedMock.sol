//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../token/ERC721Owned.sol";

contract ERC721OwnedMock is ERC721Owned {
    // solhint-disable-next-line no-empty-blocks
    constructor(address initialOwner) ERC721Owned(initialOwner) {}

		// solhint-disable-next-line payable/only-payable
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory baseURL
    ) public {
        _initialize(tokenName, tokenSymbol, baseURL);
    }

		// solhint-disable-next-line payable/only-payable
    function mint(uint256 tokenId) external {
        _mint(msg.sender, tokenId);
    }

		// solhint-disable-next-line payable/only-payable
    function mintTo(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
