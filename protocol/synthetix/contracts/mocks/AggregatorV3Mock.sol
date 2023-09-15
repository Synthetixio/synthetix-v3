//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/external/IAggregatorV3Interface.sol";

contract AggregatorV3Mock is IAggregatorV3Interface {
    uint80 private _roundId;
    uint256 private _timestamp;
    uint256 private _price;

    function decimals() external pure override returns (uint8) {
        return 18;
    }

    function description() external pure override returns (string memory) {
        return "Fake price feed";
    }

    function version() external pure override returns (uint256) {
        return 3;
    }

    function mockSetCurrentPrice(uint256 currentPrice) external {
        _price = currentPrice;
        _timestamp = block.timestamp;
        _roundId++;
    }

    // getRoundData and latestRoundData should both raise "No data present"
    // if they do not have data to report, instead of returning unset values
    // which could be misinterpreted as actual reported values.
    function getRoundData(
        uint80
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return this.latestRoundData();
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        // solhint-disable-next-line numcast/safe-cast
        return (_roundId, int256(_price), _timestamp, _timestamp, _roundId);
    }

    function setRoundId(uint80 roundId) external {
        _roundId = roundId;
    }

    function setTimestamp(uint256 timestamp) external {
        _timestamp = timestamp;
    }
}
