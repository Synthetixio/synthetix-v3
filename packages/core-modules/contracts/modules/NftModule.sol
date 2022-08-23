//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721Enumerable.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../storage/NftStorage.sol";

import "../interfaces/INftModule.sol";

contract NftModule is INftModule, ERC721Enumerable, NftStorage, InitializableMixin, OwnableMixin {
    event Mint(address owner, uint nftId);

    // ---------------------------------------
    // Chores
    // ---------------------------------------
    function _isInitialized() internal view override returns (bool) {
        return _nftStore().initialized;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
        NftStore storage store = _nftStore();

        store.initialized = true;
    }
}
