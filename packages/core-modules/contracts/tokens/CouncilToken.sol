//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC721.sol";

contract CouncilToken is Ownable, UUPSImplementation, ERC721 {
    error TokenIsNotTransferable();

    function initialize(string memory tokenName, string memory tokenSymbol) public onlyOwner {
        _initialize(tokenName, tokenSymbol, "");
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function mint(address to, uint256 tokenId) public virtual onlyOwner {
        _mint(to, tokenId);
    }

    function burn(uint256 tokenId) public virtual onlyOwner {
        _burn(tokenId);
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public virtual override {
        revert TokenIsNotTransferable();
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override {
        revert TokenIsNotTransferable();
    }
}
