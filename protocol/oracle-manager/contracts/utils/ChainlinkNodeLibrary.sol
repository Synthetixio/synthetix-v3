// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";
import "../interfaces/external/IAggregatorV3Interface.sol";

library ChainlinkNodeLibrary {
    uint256 public constant PRECISION = 18;

    function process(bytes memory parameters) internal view returns (Node.Data memory) {
        (address chainlinkAggr, uint256 twapTimeInterval, uint8 decimals) = abi.decode(
            parameters,
            (address, uint256, uint8)
        );

        (uint80 roundId, int256 price, , uint256 updatedAt, ) = IAggregatorV3Interface(
            chainlinkAggr
        ).latestRoundData();
        int256 finalPrice = twapTimeInterval == 0
            ? price
            : getTwapPrice(chainlinkAggr, roundId, price, twapTimeInterval);

        finalPrice = decimals > PRECISION
            ? int256(downscale(uint256(finalPrice), decimals - PRECISION))
            : upscale(finalPrice, PRECISION - decimals);

        return Node.Data(finalPrice, updatedAt, 0, 0);
    }

    function getTwapPrice(
        address chainlinkAggr,
        uint80 latestRoundId,
        int256 latestPrice,
        uint256 twapTimeInterval
    ) internal view returns (int256) {
        int256 priceSum = latestPrice;
        uint256 priceCount = 1;

        uint256 startTime = block.timestamp - twapTimeInterval;

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

        return priceSum / int256(priceCount);
    }

    function upscale(int256 x, uint256 factor) internal pure returns (int256) {
        return x * int256(10 ** factor);
    }

    function downscale(uint256 x, uint256 factor) internal pure returns (uint256) {
        return x / 10 ** factor;
    }
}
