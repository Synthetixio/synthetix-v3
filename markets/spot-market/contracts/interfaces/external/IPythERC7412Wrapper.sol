// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPythERC7412Wrapper {
    error OracleDataRequired(address oracleContract, bytes oracleQuery);

    function getBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime
    ) external view returns (int256);

    function getLatestPrice(
        bytes32 priceId,
        uint256 stalenessTolerance
    ) external view returns (int256);

    function fulfillOracleQuery(bytes memory signedOffchainData) external payable;
}
