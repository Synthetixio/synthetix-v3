//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC721.sol";
import "../interfaces/IERC721Metadata.sol";
import "../interfaces/IERC721Receiver.sol";
import "./ERC721Storage.sol";
import "../utils/ContractUtil.sol";

contract ERC721 is IERC721, IERC721Metadata, ERC721Storage, ContractUtil {
    error InvalidOwner(address);
    error InvalidOperator(address);
    error InvalidTokenId(uint256);
    error InvalidFrom(address);
    error InvalidTo(address);
    error InvalidTransferRecipient();
    error Unauthorized(address);
    error AlreadyInitialized();

    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory initTokenURI
    ) internal virtual {
        ERC721Store storage store = _erc721Store();
        if (bytes(store.name).length > 0 || bytes(store.symbol).length > 0 || bytes(store.baseTokenURI).length > 0) {
            revert AlreadyInitialized();
        }

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.baseTokenURI = initTokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == this.supportsInterface.selector || // ERC165
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId;
    }

    function name() external view override returns (string memory) {
        return _erc721Store().name;
    }

    function symbol() external view override returns (string memory) {
        return _erc721Store().symbol;
    }

    function tokenURI(uint256 tokenId) external view override returns (string memory) {
        if (!_exists(tokenId)) {
            revert InvalidTokenId(tokenId);
        }

        string memory baseURI = _erc721Store().baseTokenURI;
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, _toString(tokenId))) : "";
    }

    function balanceOf(address owner) public view override returns (uint) {
        if (owner == address(0)) {
            revert InvalidOwner(owner);
        }
        return _erc721Store().balanceOf[owner];
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        if (!_exists(tokenId)) {
            revert InvalidTokenId(tokenId);
        }
        return _erc721Store().ownerOf[tokenId];
    }

    function approve(address to, uint256 tokenId) external virtual override payable {
        ERC721Store storage store = _erc721Store();
        address owner = store.ownerOf[tokenId];

        if (to == owner) {
            revert InvalidTo(to);
        }

        if (msg.sender != owner && !isApprovedForAll(owner, msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        store.tokenApprovals[tokenId] = to;

        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view virtual override returns (address) {
        if (!_exists(tokenId)) {
            revert InvalidTokenId(tokenId);
        }

        return _erc721Store().tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external virtual override {
        if (msg.sender == operator) {
            revert InvalidOperator(operator);
        }

        _erc721Store().operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _erc721Store().operatorApprovals[owner][operator];
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable virtual override {
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public payable virtual override {
        _transfer(from, to, tokenId);
        if (_checkOnERC721Received(from, to, tokenId, data)) {
            revert InvalidTransferRecipient();
        }
    }

    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    function _safeMint(
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal virtual {
        _mint(to, tokenId);
        if (_checkOnERC721Received(address(0), to, tokenId, data)) {
            revert InvalidTransferRecipient();
        }
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        ERC721Store storage store = _erc721Store();
        if (to == address(0)) {
            revert InvalidTo(to);
        }

        if (_exists(tokenId)) {
            // Already minted
            revert InvalidTokenId(tokenId);
        }

        store.balanceOf[to] += 1;
        store.ownerOf[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        ERC721Store storage store = _erc721Store();
        address owner = store.ownerOf[tokenId];

        store.tokenApprovals[tokenId] = address(0);
        emit Approval(owner, address(0), tokenId);

        store.balanceOf[owner] -= 1;
        delete store.ownerOf[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _erc721Store().ownerOf[tokenId] != address(0);
    }

    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        ERC721Store storage store = _erc721Store();
        address owner = ownerOf(tokenId);

        if (!_exists(tokenId)) {
            revert InvalidTokenId(tokenId);
        }

        if (owner != msg.sender && store.tokenApprovals[tokenId] != msg.sender && !isApprovedForAll(from, msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        if (ownerOf(tokenId) != from) {
            revert InvalidFrom(from);
        }

        if (to == address(0)) {
            revert InvalidTo(to);
        }

        // Clear approvals from the previous owner
        store.tokenApprovals[tokenId] = address(0);

        store.balanceOf[from] -= 1;
        store.balanceOf[to] += 1;
        store.ownerOf[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (_isContract(to)) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert InvalidTransferRecipient();
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }
}
