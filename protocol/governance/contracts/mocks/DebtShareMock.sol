//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";

contract DebtShareMock is IDebtShare {
    struct Period {
        mapping(address => uint256) balances;
    }

    mapping(uint128 => Period) private _periods;

    function setBalanceOfOnPeriod(address user, uint256 balance, uint256 periodId) external {
        // solhint-disable-next-line numcast/safe-cast
        Period storage period = _periods[uint128(periodId)];

        period.balances[user] = balance;
    }

    function balanceOfOnPeriod(
        address user,
        uint256 periodId
    ) external view virtual override returns (uint256) {
        // solhint-disable-next-line numcast/safe-cast
        Period storage period = _periods[uint128(periodId)];

        return period.balances[user];
    }
}
