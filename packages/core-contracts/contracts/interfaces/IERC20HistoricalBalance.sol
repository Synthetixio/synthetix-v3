//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20HistoricalBalance {
    function totalSupplyAt(uint blockNumber) external view returns (uint);

    function balanceOfAt(address owner, uint blockNumber) external view returns (uint);
}
