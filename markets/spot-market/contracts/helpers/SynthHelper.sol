//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20Storage.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../interfaces/ISpotMarketFee.sol";

/*
    Remove this after core contracts are refactored to using new storage pattern
*/
contract SynthHelper {
    event Transfer(address indexed from, address indexed to, uint amount);
    event Approval(address indexed owner, address indexed spender, uint amount);

    error InsufficientBalance(uint required, uint existing);

    /* copied from core-contracts/contracts/token/ERC20.sol */
    function _mint(address to, uint256 amount) internal virtual {
        ERC20Storage.Data storage store = ERC20Storage.load();

        store.totalSupply += amount;

        // No need for overflow check since it is done in the previous step
        unchecked {
            store.balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal virtual {
        ERC20Storage.Data storage store = ERC20Storage.load();

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

    function _getAllowance(address owner, address spender) internal view returns (uint) {
        return ERC20Storage.load().allowance[owner][spender];
    }

    function _getBalanceOf(address owner) internal view returns (uint) {
        return ERC20Storage.load().balanceOf[owner];
    }

    function _getTotalSupply() internal view returns (uint) {
        return ERC20Storage.load().totalSupply;
    }

    function _getName() internal view returns (string memory) {
        return ERC20Storage.load().name;
    }
    // -------
}
