//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/external/IAggregatorV3Interface.sol";

contract MockV3Aggregator is IAggregatorV3Interface {
    uint80 private _roundId;
    uint private _timestamp;
    uint private _price;
    uint8 private _decimals;

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return "Fake price feed";
    }

    function version() external pure override returns (uint256) {
        return 3;
    }

    function mockSetCurrentPrice(uint currentPrice, uint8 decimal) external {
        _price = currentPrice;
        _timestamp = block.timestamp;
        _roundId++;
        _decimals = decimal;
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
        return (_roundId, int(_price), _timestamp, _timestamp, _roundId);
    }

    function setRoundId(uint80 roundId) external {
        _roundId = roundId;
    }

    function setTimestamp(uint timestamp) external {
        _timestamp = timestamp;
    }
}
