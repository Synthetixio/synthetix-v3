//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";

contract DebtShareMock is IDebtShare {
    struct Period {
        mapping(address => uint) balances;
    }

    mapping(uint128 => Period) private _periods;

    function setBalanceOfOnPeriod(address user, uint balance, uint periodId) external {
        // solhint-disable-next-line numcast/safe-cast
        Period storage period = _periods[uint128(periodId)];

        period.balances[user] = balance;
    }

    function balanceOfOnPeriod(
        address user,
        uint periodId
    ) external view virtual override returns (uint) {
        // solhint-disable-next-line numcast/safe-cast
        Period storage period = _periods[uint128(periodId)];

        return period.balances[user];
    }
}
