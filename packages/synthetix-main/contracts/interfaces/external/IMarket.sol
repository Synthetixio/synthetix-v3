//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface a Market needs to adhere.
interface IMarket {
    /// @notice returns amount of USD that the market would try to mint if everything was withdrawn
    function reportedDebt(uint marketId) external view returns (uint);
}
