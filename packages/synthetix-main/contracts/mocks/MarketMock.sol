//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IMarket.sol";

contract MarketMock is IMarket {
    int private _balance;

    function setBalance(int newBalance) external {
        _balance = newBalance;
    }

    function balance() external view override returns (int) {
        return _balance;
    }
}
