//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ISnapshotRecord} from "../interfaces/external/ISnapshotRecord.sol";

contract SnapshotRecordMock is ISnapshotRecord {
    struct Period {
        mapping(address => uint256) balances;
    }

    mapping(uint128 => Period) private _periods;
    mapping(uint128 => uint256) private _totalSupplyOnPeriod;

    // start at 1 to help the tests
    uint128 public currentPeriodId = 1;

    function setBalanceOfOnPeriod(address user, uint256 balance, uint256 periodId) external {
        // solhint-disable-next-line numcast/safe-cast
        Period storage period = _periods[uint128(periodId)];

        period.balances[user] = balance;
    }

    function balanceOfOnPeriod(
        address user,
        uint256 periodId
    ) external view override returns (uint256) {
        Period storage period = _periods[uint128(periodId)];

        return period.balances[user];
    }

    // solhint-disable-next-line no-empty-blocks
    function takeSnapshot(uint128 snapshotId) external override {
        // do nothing
    }

    function setTotalSupplyOnPeriod(uint128 snapshotId, uint256 totalSupply) external {
        _totalSupplyOnPeriod[snapshotId] = totalSupply;
    }

    function totalSupplyOnPeriod(uint256) external pure override returns (uint256) {
        return 0;
    }
}
