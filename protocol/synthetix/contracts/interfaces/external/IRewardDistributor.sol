// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

/// @title Interface a reward distributor.
interface IRewardDistributor is IERC165 {
    /// @notice Returns a human-readable name for the reward distributor
    function name() external view returns (string memory);

    /// @notice This function should revert if ERC2771Context._msgSender() is not the Synthetix CoreProxy address.
    /// @return whether or not the payout was executed
    function payout(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        address sender,
        uint256 amount
    ) external returns (bool);

    /// @notice This function is called by the Synthetix Core Proxy whenever
    /// a position is updated on a pool which this distributor is registered
    function onPositionUpdated(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 newShares
    ) external;

    /// @notice Address to ERC-20 token distributed by this distributor, for display purposes only
    /// @dev Return address(0) if providing non ERC-20 rewards
    function token() external view returns (address);
}
