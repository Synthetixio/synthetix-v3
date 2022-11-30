// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/Node.sol";
import "../interfaces/external/IAggregatorV3Interface.sol";

library ChainlinkNodeLibrary {
    function process(bytes memory parameters) internal view returns (Node.Data memory) {
        (address chainlinkAggr, bool useTwap) = abi.decode(parameters, (address, bool));

        (uint80 roundId, int256 price, , uint256 updatedAt, ) = IAggregatorV3Interface(chainlinkAggr).latestRoundData();
        int256 finalPrice = useTwap ? getTwapPrice(chainlinkAggr, roundId) : price;
        return Node.Data(finalPrice, updatedAt, 0, 0);
    }

    function getTwapPrice(address chainlinkAggr, uint256 previousRoundId) internal view returns (int256) {
        (uint64 phaseId, uint64 aggregatorRoundId) = decryptRoundId(previousRoundId);

        uint256 sum = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < 10; i++) {
            (uint80 roundId, int256 price, , uint256 updatedAt, ) = IAggregatorV3Interface(chainlinkAggr).getRoundData(
                aggregatorRoundId
            );
            (uint64 roundPhaseId, uint64 roundAggregatorRoundId) = decryptRoundId(roundId);

            if (roundPhaseId != phaseId) {
                break;
            }

            sum += uint256(price);
            count += 1;
            aggregatorRoundId = roundAggregatorRoundId;
        }

        return int256(count == 0 ? 0 : sum / count);
    }

    function decryptRoundId(uint256 roundId) internal pure returns (uint64 phaseId, uint64 aggregatorRoundId) {
        uint64 largestNum = 0xFFFFFFFFFFFFFFFF;
        phaseId = uint64(roundId >> 64);
        aggregatorRoundId = uint64(roundId & largestNum);
    }
}
