//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";

import "../interfaces/IFundToken.sol";
import "../storage/FundTokenStorage.sol";

contract FundToken is IFundToken, ERC721, FundTokenStorage, InitializableMixin, UUPSImplementation, Ownable {
    event FundMinted(address owner, uint fundId);
    event NominatedNewOwner(address nominatedOwner, uint256 fundId);
    event OwnershipAccepted(address newOwner, uint256 fundId);
    event OwnershipRenounced(address target, uint256 fundId);

    error NotAllowed();

    // ---------------------------------------
    // Chores
    // ---------------------------------------
    function _isInitialized() internal view override returns (bool) {
        return _fundTokenStore().initialized;
    }

    function isFundTokenInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);

        _fundTokenStore().initialized = true;
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    // ---------------------------------------
    // Mint/Transfer
    // ---------------------------------------
    function mint(address owner, uint256 fundId) external override onlyOwner {
        _mint(owner, fundId);

        emit FundMinted(owner, fundId);
    }

    // solhint-disable no-unused-vars
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) public override {
        revert NotAllowed();
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        revert NotAllowed();
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        revert NotAllowed();
    }

    // solhint-enable no-unused-vars

    function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external override {
        if (!_isApprovedOrOwner(msg.sender, fundId)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _fundTokenStore().nominatedOwnerOf[fundId] = nominatedOwner;

        emit NominatedNewOwner(nominatedOwner, fundId);
    }

    function acceptFundOwnership(uint256 fundId) external override {
        if (_fundTokenStore().nominatedOwnerOf[fundId] != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        // Need to bring safeTransferFrom functionality from ERC721 implementation since it was set as NotAllowed
        // Also, don't check for owner or authorized, since is a 2-step transfer
        _transfer(ownerOf(fundId), msg.sender, fundId);
        if (!_checkOnERC721Received(ownerOf(fundId), msg.sender, fundId, "")) {
            revert InvalidTransferRecipient(msg.sender);
        }
        // End safeTransferFrom

        _fundTokenStore().nominatedOwnerOf[fundId] = address(0);

        emit OwnershipAccepted(msg.sender, fundId);
    }

    function renounceFundNomination(uint256 fundId) external override {
        if (_fundTokenStore().nominatedOwnerOf[fundId] != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _fundTokenStore().nominatedOwnerOf[fundId] = address(0);

        emit OwnershipRenounced(msg.sender, fundId);
    }
}
