//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/NftModule.sol";
import "../../../contracts/interfaces/IAccountTokenModule.sol";

contract AccountTokenModule is IAccountTokenModule, NftModule {
    function mint(address owner, uint256 nftId) external onlyOwner {
        _mint(owner, nftId);

        emit Mint(owner, nftId);
    }
}
