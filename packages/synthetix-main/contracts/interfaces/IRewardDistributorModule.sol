//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewardDistributorModule {
    function setRewardAllocation(uint128 poolId, uint allocation) external;

    function getRewardAllocation(uint128 poolId) external view returns (uint);
}
