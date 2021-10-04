//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../interfaces/IERC20.sol";

abstract contract ERC20 is IERC20 {
    string public override name;

    string public override symbol;

    uint8 public immutable override decimals;

    mapping(address => uint256) public override balanceOf;

    mapping(address => mapping(address => uint256)) public override allowance;

    uint256 public override totalSupply;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) {
        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        allowance[msg.sender][spender] = amount;

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
        // it reverts if the sender does not have sufficient allowance
        allowance[from][msg.sender] -= amount;

        _transfer(from, to, amount);

        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        // it reverts if the sender does not have sufficient balance
        balanceOf[from] -= amount;
        // we are now sure that we can perform this operation safely since it didn't revert in the previous step
        // i.e. the total supply cannot exceed the maximum value of uint256
        unchecked {
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        // no need for overflow check since it is done in the previous step
        unchecked {
            balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        balanceOf[from] -= amount;

        // no need for underflow check since it would have occured in the previous step
        unchecked {
            totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }
}
