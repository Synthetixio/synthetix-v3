//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

contract USDTokenModule is TokenModule, IUSDTokenModule {
    function burnWithAllowance(
        address from,
        address spender,
        uint amount
    ) external {
        OwnableStorage.onlyOwner();

        ERC20Storage.Data storage store = ERC20Storage.load();

        if (amount < store.allowance[from][spender]) {
            revert InsufficientAllowance(amount, store.allowance[from][spender]);
        }
        store.allowance[from][spender] -= amount;
        _burn(from, amount);
    }
}
