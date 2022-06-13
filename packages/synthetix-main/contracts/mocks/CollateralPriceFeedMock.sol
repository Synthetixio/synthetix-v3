//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAggregatorV3Interface.sol";

contract AggregatorV3Mock is IAggregatorV3Interface {
    uint80 private _roundId;
    uint private _timestamp;
    uint private _price;

  function decimals() external view returns (uint8) {
      return 18;
  }

  function description() external view returns (string memory) {
      return "Fake price feed";
  }

  function version() external view returns (uint256) {
      return 3;
  }

  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(uint80 id)
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
        return this.latestRoundData();
    }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
        return (
            _roundId,
            int(_price),
            _timestamp,
            _timestamp,
            _roundId
        );
    }

    function setRoundId(uint80 roundId) external {
        _roundId = roundId;
    }

    function setTimestamp(uint timestamp) external {
        _timestamp = timestamp;
    }
}
