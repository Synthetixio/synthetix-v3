//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/NftModule.sol";

contract AccountTokenModule is NftModule {
    // ---------------------------------------
    // Mint/Transfer
    // ---------------------------------------
    function mint(address owner, uint256 nftId) external onlyOwner {
        _mint(owner, nftId);

        emit Mint(owner, nftId);
    }
}
