//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC20.sol";
import "./ERC20Storage.sol";

contract ERC20 is IERC20, ERC20Storage {
    error InsufficientAllowance(uint required, uint existing);
    error InsufficientBalance(uint required, uint existing);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) {
        ERC20Namespace storage store = _erc20Storage();

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.decimals = tokenDecimals;
    }

    function name() external view override returns (string memory) {
        return _erc20Storage().name;
    }

    function symbol() external view override returns (string memory) {
        return _erc20Storage().symbol;
    }

    function decimals() external view override returns (uint8) {
        return _erc20Storage().decimals;
    }

    function totalSupply() external view override returns (uint) {
        return _erc20Storage().totalSupply;
    }

    function allowance(address owner, address spender) public view override returns (uint) {
        return _erc20Storage().allowance[owner][spender];
    }

    function balanceOf(address owner) public view override returns (uint) {
        return _erc20Storage().balanceOf[owner];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _erc20Storage().allowance[msg.sender][spender] = amount;

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
        ERC20Namespace storage store = _erc20Storage();

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
        ERC20Namespace storage store = _erc20Storage();

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
        ERC20Namespace storage store = _erc20Storage();

        store.totalSupply += amount;

        // No need for overflow check since it is done in the previous step
        unchecked {
            store.balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        ERC20Namespace storage store = _erc20Storage();

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
