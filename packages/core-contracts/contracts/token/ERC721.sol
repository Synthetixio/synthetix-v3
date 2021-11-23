//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC721.sol";
import "../interfaces/IERC721Metadata.sol";
import "./ERC721Storage.sol";

contract ERC20 is IERC721, IERC721Metadata, ERC721Storage {
    error InvalidOwner();
    error AlreadyInitialized();

    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory initTokenURI
    ) internal virtual {
        ERC721Store storage store = _erc721Store();
        if (bytes(store.name).length > 0 || bytes(store.symbol).length > 0  || bytes(store.tokenURI).length > 0 ) {
            revert AlreadyInitialized();
        }

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.tokenURI = initTokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == this.supportsInterface.selector || // ERC165
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function name() external view override returns (string memory) {
        return _erc721Store().name;
    }

    function symbol() external view override returns (string memory) {
        return _erc721Store().symbol;
    }

    function tokenURI() external view override returns (string memory) {
        return _erc721Store().symbol;
    }

    function balanceOf(address owner) public view override returns (uint) {
        return _erc721Store().balanceOf[owner];
    }

    function ownerOf(uint256 tokenId) public view override returns (uint) {
        address owner = _erc721Store().ownerOf[tokenId];
        if (owner == address(0)) {
            revert InvalidOwner();
        }
        return owner;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external payable;

    function safeTransferFrom(address from, address to, uint256 tokenId) external payable;

    function transferFrom(address from, address to, uint256 tokenId) external payable;

    function approve(address approved, uint256 tokenId) external payable;

    function setApprovalForAll(address operator, bool approved) external;

    function getApproved(uint256 tokenId) external view returns (address);

    function isApprovedForAll(address owner, address operator) external view returns (bool);


    function approve(address spender, uint256 amount) public override returns (bool) {
        _erc721Store().allowance[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);

        return true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, to, amount);

        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint amount
    ) external override returns (bool) {
        ERC20Store storage store = _erc721Store();

        uint256 currentAllowance = store.allowance[from][msg.sender];
        if (currentAllowance < amount) {
            revert InsufficientAllowance(amount, currentAllowance);
        }

        unchecked {
            store.allowance[from][msg.sender] -= amount;
        }

        _transfer(from, to, amount);

        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        ERC20Store storage store = _erc721Store();

        uint256 accountBalance = store.balanceOf[from];
        if (accountBalance < amount) {
            revert InsufficientBalance(amount, accountBalance);
        }

        // We are now sure that we can perform this operation safely
        // since it didn't revert in the previous step.
        // The total supply cannot exceed the maximum value of uint256,
        // thus we can now perform accounting operations in unchecked mode.
        unchecked {
            store.balanceOf[from] -= amount;
            store.balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        ERC20Store storage store = _erc721Store();

        store.totalSupply += amount;

        // No need for overflow check since it is done in the previous step
        unchecked {
            store.balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        ERC20Store storage store = _erc721Store();

        uint256 accountBalance = store.balanceOf[from];
        if (accountBalance < amount) {
            revert InsufficientBalance(amount, accountBalance);
        }

        // No need for underflow check since it would have occured in the previous step
        unchecked {
            store.balanceOf[from] -= amount;
            store.totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }
}
