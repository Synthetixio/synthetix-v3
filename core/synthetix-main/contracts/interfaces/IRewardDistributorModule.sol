//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewardDistributorModule {
    function setRewardAllocation(uint poolId, uint allocation) external;

    function getRewardAllocation(uint poolId) external view returns (uint);
}
