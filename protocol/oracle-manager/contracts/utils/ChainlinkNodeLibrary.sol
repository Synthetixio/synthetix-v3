// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";
import "../interfaces/external/IAggregatorV3Interface.sol";

library ChainlinkNodeLibrary {
    function process(bytes memory parameters) internal view returns (Node.Data memory) {
        (address chainlinkAggr, uint twapTimeInterval) = abi.decode(parameters, (address, uint));

        (uint80 roundId, int256 price, , uint256 updatedAt, ) = IAggregatorV3Interface(
            chainlinkAggr
        ).latestRoundData();
        int256 finalPrice = twapTimeInterval == 0
            ? price
            : getTwapPrice(chainlinkAggr, roundId, price, twapTimeInterval);
        return Node.Data(finalPrice, updatedAt, 0, 0);
    }

    function getTwapPrice(
        address chainlinkAggr,
        uint80 latestRoundId,
        int latestPrice,
        uint twapTimeInterval
    ) internal view returns (int256) {
        int priceSum = latestPrice;
        uint priceCount = 1;

        uint startTime = block.timestamp - twapTimeInterval;

        while (latestRoundId > 0) {
            try IAggregatorV3Interface(chainlinkAggr).getRoundData(--latestRoundId) returns (
                uint80,
                int256 answer,
                uint256,
                uint256 updatedAt,
                uint80
            ) {
                if (updatedAt < startTime) {
                    break;
                }
                priceSum += answer;
                priceCount++;
            } catch {
                break;
            }
        }

        return priceSum / int(priceCount);
    }
}
