//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Mocked PythERC7412Wrapper used in tests.
 */
contract MockPythERC7412Wrapper {
    mapping(uint64 => int64) public benchmarkPrices;
    uint64 public latestTime;
    int64 public latestPrice;

    error OracleDataRequired(address oracleContract, bytes oracleQuery);

    function setBenchmarkPrice(uint64 requestedTime, int64 price) external {
        benchmarkPrices[requestedTime] = price;
    }

    function setLatestPrice(uint64 time, int64 price) external {
        latestTime = time;
        latestPrice = price;
    }

    function getBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime
    ) external view returns (int64) {
        int64 price = benchmarkPrices[requestedTime];

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
    ) external view returns (int64) {
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
