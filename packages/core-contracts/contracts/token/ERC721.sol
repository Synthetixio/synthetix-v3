//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC721.sol";
import "../interfaces/IERC721Metadata.sol";
import "../interfaces/IERC721Receiver.sol";
import "../errors/AddressError.sol";
import "../errors/AccessError.sol";
import "../errors/InitError.sol";
import "./ERC721Storage.sol";
import "../utils/AddressUtil.sol";
import "../utils/StringUtil.sol";

/*
    Reference implementations:
    * OpenZeppelin - https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/ERC721.sol
*/

contract ERC721 is IERC721, IERC721Metadata, ERC721Storage {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error CannotSelfApprove(address);
    error InvalidTransferRecipient(address);
    error TokenDoesNotExist(uint256);
    error TokenAlreadyMinted(uint256);

    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory baseTokenURI
    ) internal virtual {
        ERC721Store storage store = _erc721Store();
        if (bytes(store.name).length > 0 || bytes(store.symbol).length > 0 || bytes(store.baseTokenURI).length > 0) {
            revert InitError.AlreadyInitialized();
        }

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.baseTokenURI = baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == this.supportsInterface.selector || // ERC165
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId;
    }

    function balanceOf(address holder) public view virtual override returns (uint) {
        if (holder == address(0)) {
            revert AddressError.ZeroAddress();
        }

        return _erc721Store().balanceOf[holder];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        if (!_exists(tokenId)) {
            revert TokenDoesNotExist(tokenId);
        }

        return _erc721Store().ownerOf[tokenId];
    }

    function name() external view virtual override returns (string memory) {
        return _erc721Store().name;
    }

    function symbol() external view virtual override returns (string memory) {
        return _erc721Store().symbol;
    }

    function tokenURI(uint256 tokenId) external view virtual override returns (string memory) {
        if (!_exists(tokenId)) {
            revert TokenDoesNotExist(tokenId);
        }

        string memory baseURI = _erc721Store().baseTokenURI;

        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, StringUtil.uintToString(tokenId))) : "";
    }

    function approve(address to, uint256 tokenId) public virtual override {
        ERC721Store storage store = _erc721Store();
        address holder = store.ownerOf[tokenId];

        if (to == holder) {
            revert CannotSelfApprove(to);
        }

        if (msg.sender != holder && !isApprovedForAll(holder, msg.sender)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        if (!_exists(tokenId)) {
            revert TokenDoesNotExist(tokenId);
        }

        return _erc721Store().tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        if (msg.sender == operator) {
            revert CannotSelfApprove(operator);
        }

        _erc721Store().operatorApprovals[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address holder, address operator) public view virtual override returns (bool) {
        return _erc721Store().operatorApprovals[holder][operator];
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public virtual override {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _transfer(from, to, tokenId);
        if (!_checkOnERC721Received(from, to, tokenId, data)) {
            revert InvalidTransferRecipient(to);
        }
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _erc721Store().ownerOf[tokenId] != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        address holder = ownerOf(tokenId);

        // Not checking tokenId existence since it is checked in ownerOf() and getApproved()

        return (spender == holder || getApproved(tokenId) == spender || isApprovedForAll(holder, spender));
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        ERC721Store storage store = _erc721Store();
        if (to == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (_exists(tokenId)) {
            revert TokenAlreadyMinted(tokenId);
        }

        store.balanceOf[to] += 1;
        store.ownerOf[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        ERC721Store storage store = _erc721Store();
        address holder = store.ownerOf[tokenId];

        _approve(address(0), tokenId);

        store.balanceOf[holder] -= 1;
        delete store.ownerOf[tokenId];

        emit Transfer(holder, address(0), tokenId);
    }

    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        ERC721Store storage store = _erc721Store();

        if (ownerOf(tokenId) != from) {
            revert AccessError.Unauthorized(from);
        }

        if (to == address(0)) {
            revert AddressError.ZeroAddress();
        }

        // Clear approvals from the previous holder
        _approve(address(0), tokenId);

        store.balanceOf[from] -= 1;
        store.balanceOf[to] += 1;
        store.ownerOf[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _erc721Store().tokenApprovals[tokenId] = to;
        emit Approval(ERC721.ownerOf(tokenId), to, tokenId);
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (AddressUtil.isContract(to)) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch {
                return false;
            }
        } else {
            return true;
        }
    }
}
