//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface a Market needs to adhere.
interface IMarket {
    /// @notice returns the balance of the market
    function balance() external view returns (int);
}
