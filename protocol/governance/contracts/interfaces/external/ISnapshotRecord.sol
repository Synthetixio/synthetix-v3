//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISnapshotRecord {
    function currentPeriodId() external view returns (uint128);

    function balanceOfOnPeriod(address account, uint periodId) external view returns (uint);

    function totalSupplyOnPeriod(uint periodId) external view returns (uint);

    function takeSnapshot(uint128 id) external;
}
