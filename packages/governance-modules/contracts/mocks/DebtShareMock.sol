//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";

contract DebtSareMock is IDebtShare {
    uint128 private _currentPeriodId;

    function currentPeriodId() external view override returns (uint128) {
        return _currentPeriodId;
    }

    function takeSnapshot(uint128 id) external override {
        _currentPeriodId = id;
    }

    function balanceOfOnPeriod(address, uint) external pure override returns (uint) {
        return 1;
    }
}
