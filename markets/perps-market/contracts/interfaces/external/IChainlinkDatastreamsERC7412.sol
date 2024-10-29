// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IChainlinkDatastreamsERC7412 {
    error OracleDataRequired(address oracleContract, bytes oracleQuery, uint256 feeRequired);

    function getPriceForTimestamp(
        bytes32 feedId,
        uint32 forTimestamp
    ) external view returns (int192);
}
