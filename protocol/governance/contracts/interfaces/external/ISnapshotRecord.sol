//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISnapshotRecord {
    function currentPeriodId() external view returns (uint128);

    function balanceOfOnPeriod(address account, uint256 periodId) external view returns (uint256);

    function totalSupplyOnPeriod(uint256 periodId) external view returns (uint256);

    function takeSnapshot(uint128 id) external;
}
