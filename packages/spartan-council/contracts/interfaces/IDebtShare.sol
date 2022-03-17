//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDebtShare {
    function currentPeriodId() external view returns (uint128);

    function takeSnapshot(uint128 id) external;

    function balanceOfOnPeriod(address account, uint periodId) external view returns (uint);
}
