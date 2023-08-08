// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISnapshotRecord {
    function balanceOfOnPeriod(address account, uint128 periodId) external view returns (uint);

    function totalSupplyOnPeriod(uint128 periodId) external view returns (uint);

    function takeSnapshot(uint128 id) external;
}
