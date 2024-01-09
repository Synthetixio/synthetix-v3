//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

/// @title Interface for markets integrated with Synthetix
interface IMarket is IERC165 {
    /// @notice returns a human-readable name for a given market
    function name(uint128 marketId) external view returns (string memory);

    /// @notice returns amount of USD that the market would try to mint if everything was withdrawn
    function reportedDebt(uint128 marketId) external view returns (uint256);

    /// @notice prevents reduction of available credit capacity by specifying this amount, for which withdrawals will be disallowed
    function minimumCredit(uint128 marketId) external view returns (uint256);
}
