//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDebtShare {
    function balanceOfOnPeriod(address account, uint256 periodId) external view returns (uint256);
}
