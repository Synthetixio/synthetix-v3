//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceFeed {
    function getCurrentPrice() external view returns (uint);
}
