pragma solidity ^0.8.0;
// SPDX-License-Identifier: MIT

interface ISnapshotRecord {
		function balanceOfOnPeriod(address account, uint periodId) external view returns (uint);
		function totalSupplyOnPeriod(uint periodId) external view returns (uint);
		function takeSnapshot(uint128 id) external;
}
