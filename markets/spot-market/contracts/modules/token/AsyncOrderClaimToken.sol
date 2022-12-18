//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/NftModule.sol";
import "../../../contracts/interfaces/IAsyncOrderClaimToken.sol";

/**
 * @title Module with custom NFT logic for the async order claim token
 * @dev See IAsyncOrderClaimToken.
 */
contract AsyncOrderClaimToken is IAsyncOrderClaimToken, NftModule {
    /**
     * @inheritdoc IAsyncOrderClaimToken
     */
    function mint(address owner) external returns (uint256 id) {
        OwnableStorage.onlyOwner();

        id = totalSupply();
        _mint(owner, id);

        emit Mint(owner, id);
    }

    /**
     * @inheritdoc IAsyncOrderClaimToken
     */
    function burn(uint256 id) external {
        OwnableStorage.onlyOwner();

        _burn(id);

        emit Burn(id);
    }
}
