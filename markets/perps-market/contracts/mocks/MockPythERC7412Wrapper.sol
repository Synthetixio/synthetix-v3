//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {PythStructs} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";

/**
 * @title Mocked PythERC7412Wrapper used in tests.
 */
contract MockPythERC7412Wrapper {
    mapping(uint64 => int256) public benchmarkPrices;
    uint64 public latestTime;
    int256 public latestPrice;

    error OracleDataRequired(address oracleContract, bytes oracleQuery);

    function setBenchmarkPrice(uint64 requestedTime, int256 price) external {
        benchmarkPrices[requestedTime] = price;
    }

    function setLatestPrice(uint64 time, int256 price) external {
        latestTime = time;
        latestPrice = price;
    }

    function createPriceFeedUpdateData(
        bytes32 id,
        int64 price,
        uint64 conf,
        int32 expo,
        int64 emaPrice,
        uint64 emaConf,
        uint64 publishTime,
        uint64 prevPublishTime
    ) public pure returns (bytes memory priceFeedData) {
        PythStructs.PriceFeed memory priceFeed;

        priceFeed.id = id;

        priceFeed.price.price = price;
        priceFeed.price.conf = conf;
        priceFeed.price.expo = expo;
        priceFeed.price.publishTime = publishTime;

        priceFeed.emaPrice.price = emaPrice;
        priceFeed.emaPrice.conf = emaConf;
        priceFeed.emaPrice.expo = expo;
        priceFeed.emaPrice.publishTime = publishTime;

        priceFeedData = abi.encode(priceFeed, prevPublishTime);
    }

    function getBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime
    ) external view returns (int256) {
        int256 price = benchmarkPrices[requestedTime];

        if (price > 0) {
            return price;
        }

        revert OracleDataRequired(
            // solhint-disable-next-line numcast/safe-cast
            address(this),
            abi.encode(
                // solhint-disable-next-line numcast/safe-cast
                uint8(2), // PythQuery::Benchmark tag
                // solhint-disable-next-line numcast/safe-cast
                uint64(requestedTime),
                [priceId]
            )
        );
    }

    function getLatestPrice(
        bytes32 priceId,
        uint256 stalenessTolerance
    ) external view returns (int256) {
        if (block.timestamp <= stalenessTolerance + latestTime) {
            return latestPrice;
        }

        //price too stale
        revert OracleDataRequired(
            address(this),
            abi.encode(
                // solhint-disable-next-line numcast/safe-cast
                uint8(1),
                // solhint-disable-next-line numcast/safe-cast
                uint64(stalenessTolerance),
                [priceId]
            )
        );
    }
}
