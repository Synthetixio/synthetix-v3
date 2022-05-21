//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";

contract DebtShareMock is IDebtShare {
    struct Period {
        mapping(address => uint) balances;
    }

    mapping(uint128 => Period) _periods;

    function setBalanceOfOnPeriod(address user, uint balance, uint128 periodId) external {
        Period storage period = _periods[periodId];

        period.balances[user] = balance;
    }

    function balanceOfOnPeriod(address user, uint128 periodId) external view virtual override returns (uint) {
        Period storage period = _periods[periodId];

        return period.balances[user];
    }
}
