//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/token/ERC721Enumerable.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../storage/Initialized.sol";

import "../interfaces/INftModule.sol";

/**
 * @title Module wrapping an ERC721 token implementation.
 * See INftModule.
 */
contract NftModule is INftModule, ERC721Enumerable, InitializableMixin {
    bytes32 internal constant _INITIALIZED_NAME = "NftModule";

    /**
     * @inheritdoc INftModule
     */
    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    /**
     * @inheritdoc INftModule
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external {
        OwnableStorage.onlyOwner();

        _initialize(tokenName, tokenSymbol, uri);
        Initialized.load(_INITIALIZED_NAME).initialized = true;
    }

    /**
     * @inheritdoc INftModule
     */
    function burn(uint256 tokenId) external override {
        OwnableStorage.onlyOwner();
        _burn(tokenId);
    }

    /**
     * @inheritdoc INftModule
     */
    function mint(address to, uint256 tokenId) external override {
        OwnableStorage.onlyOwner();
        _mint(to, tokenId);
    }

    /**
     * @inheritdoc INftModule
     */
    function safeMint(address to, uint256 tokenId, bytes memory data) external override {
        OwnableStorage.onlyOwner();
        _mint(to, tokenId);

        if (!_checkOnERC721Received(address(0), to, tokenId, data)) {
            revert InvalidTransferRecipient(to);
        }
    }

    /**
     * @inheritdoc INftModule
     */
    function setBaseTokenURI(string memory uri) external override {
        OwnableStorage.onlyOwner();
        ERC721Storage.load().baseTokenURI = uri;
    }

    /**
     * @inheritdoc INftModule
     */
    function setAllowance(uint256 tokenId, address spender) external override {
        OwnableStorage.onlyOwner();
        ERC721Storage.load().tokenApprovals[tokenId] = spender;
    }

    function _isInitialized() internal view override returns (bool) {
        return Initialized.load(_INITIALIZED_NAME).initialized;
    }
}
