//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewardDistributorModule {
    /// @notice returns a human-readable name for a this rewards distributor
    function name() external view returns (string memory);

    function setRewardAllocation(uint128 poolId, uint allocation) external;

    function getRewardAllocation(uint128 poolId) external view returns (uint);
}
