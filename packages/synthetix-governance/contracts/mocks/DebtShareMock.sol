//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";

contract DebtShareMock is IDebtShare {
    uint128 private _currentPeriodId;
    mapping(address => uint) private _balances;
    mapping(address => bool) private _setAddresses;

    function currentPeriodId() external view override returns (uint128) {
        return _currentPeriodId;
    }

    function takeSnapshot(uint128 id) external override {
        _currentPeriodId = id;
    }

    function setBalanceOf(address user, uint balance) external {
        _balances[user] = balance;
        _setAddresses[user] = true;
    }

    function balanceOfOnPeriod(address user, uint) external view override returns (uint) {
        if (_setAddresses[user] == true) {
            return _balances[user];
        }
        return (uint(_currentPeriodId) + 2)**18;
    }
}
