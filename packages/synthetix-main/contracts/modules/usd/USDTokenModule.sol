//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

contract USDTokenModule is TokenModule, IUSDTokenModule {
    function burnWithAllowance(address from, address spender, uint amount) external onlyOwner {
        if (amount <  _erc20Store().allowance[from][spender]) {
            revert InsufficientAllowance(amount, _erc20Store().allowance[from][spender]);
        }
        _erc20Store().allowance[from][spender] -= amount;
        _burn(from, amount);
    }
}
