//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDebtShare {
    function balanceOfOnPeriod(address account, uint128 periodId) external view returns (uint);
}
