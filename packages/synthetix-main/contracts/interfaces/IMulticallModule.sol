//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IMulticallModule {
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}
