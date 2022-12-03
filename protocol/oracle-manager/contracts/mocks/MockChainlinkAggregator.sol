//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockChainlinkAggregator {
    int[5] private _prices;
    uint[5] private _updatedAt;

    constructor(int[5] memory prices) {
        uint currentTimestamp = block.timestamp;
        _updatedAt = [
            currentTimestamp - 75 minutes,
            currentTimestamp - 50 minutes,
            currentTimestamp - 25 minutes,
            currentTimestamp - 10 minutes,
            currentTimestamp
        ];

        _prices = prices;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (5, _prices[4], 0, _updatedAt[4], 5);
    }

    function getRoundData(
        uint80 roundId
    ) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, _prices[roundId - 1], 0, _updatedAt[roundId - 1], roundId);
    }
}
