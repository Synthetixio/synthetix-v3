// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/// @title Interface an aggregator needs to adhere.
interface IScryMetaMorph {
   
    function getFeedPortal(
        uint256 ID
    )
        external
        view
        returns (
            uint256 value,
             uint256 decimals,
             string memory valStr,
            bytes memory valBytes,
            uint timestamp
        );

}
