//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../utils/ERC20.sol";

contract ERC20Mock is ERC20 {
    bytes32 private _slot0;
    bytes32 private _slot1;
    bytes32 private _slot2;
    bytes32 private _slot3;
    bytes32 private _slot4;
    bytes32 private _slot5;
    bytes32 private _slot6;
    bytes32 private _slot7;
    bytes32 private _slot8;
    bytes32 private _slot9;

    struct ERC20Storage {
        mapping(address => uint256) balance;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
        string name;
        string symbol;
    }

    ERC20Storage erc20Storage;

    function name() public view override returns (string memory) {
        return erc20Storage.name;
    }

    function symbol() public view override returns (string memory) {
        return erc20Storage.symbol;
    }

    function totalSupply() public view override returns (uint256) {
        return erc20Storage.totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return erc20Storage.balance[account];
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return erc20Storage.allowance[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        erc20Storage.allowance[msg.sender][spender] = amount;

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
        erc20Storage.allowance[from][msg.sender] -= amount;

        _transfer(from, to, amount);

        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        // it reverts if the sender does not have sufficient balance
        erc20Storage.balance[from] -= amount;
        // we are now sure that we can perform this operation safely since it didn't revert in the previous step
        // i.e. the total supply cannot exceed the maximum value of uint256
        unchecked {
            erc20Storage.balance[to] += amount;
        }

        emit Transfer(from, to, amount);
    }
}
