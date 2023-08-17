//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ISnapshotRecord} from "../interfaces/external/ISnapshotRecord.sol";

contract SnapshotRecordMock is ISnapshotRecord {
    struct Period {
        mapping(address => uint) balances;
    }

    mapping(uint128 => Period) private _periods;
    mapping(uint128 => uint) private _totalSupplyOnPeriod;

    function setBalanceOfOnPeriod(address user, uint balance, uint periodId) external {
        // solhint-disable-next-line numcast/safe-cast
        Period storage period = _periods[uint128(periodId)];

        period.balances[user] = balance;
    }

    function balanceOfOnPeriod(
        address user,
        uint128 periodId
    ) external view override returns (uint) {
        Period storage period = _periods[periodId];

        return period.balances[user];
    }

    function takeSnapshot(uint128 snapshotId) external override {
        // do nothing
    }

    function setTotalSupplyOnPeriod(uint128 snapshotId, uint totalSupply) external {
        _totalSupplyOnPeriod[snapshotId] = totalSupply;
    }

    function totalSupplyOnPeriod(uint128) external pure override returns (uint) {
        return 0;
    }
}
