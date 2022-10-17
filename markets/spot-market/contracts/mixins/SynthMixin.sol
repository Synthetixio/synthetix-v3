//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20Storage.sol";
import "../storage/SpotMarketStorage.sol";
import "../interfaces/ISpotMarketFee.sol";

/*
    Remove this after core contracts are refactored to using new storage pattern
*/
contract SynthMixin is ERC20Storage {
    event Transfer(address indexed from, address indexed to, uint amount);
    event Approval(address indexed owner, address indexed spender, uint amount);

    error InsufficientBalance(uint required, uint existing);

    /* copied from erc20 contract */
    // -------
    function _initializeToken(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal virtual {
        ERC20Store storage store = _erc20Store();

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.decimals = tokenDecimals;
    }

    function _mint(address to, uint256 amount) internal {
        ERC20Store storage store = _erc20Store();

        store.totalSupply += amount;

        // No need for overflow check since it is done in the previous step
        unchecked {
            store.balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        ERC20Store storage store = _erc20Store();

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
        return _erc20Store().allowance[owner][spender];
    }

    function _getBalanceOf(address owner) internal view returns (uint) {
        return _erc20Store().balanceOf[owner];
    }
    // -------
}
