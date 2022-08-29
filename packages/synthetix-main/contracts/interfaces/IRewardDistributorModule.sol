//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewardDistributorModule {
    function setRewardAllocation(uint fundId, uint allocation) external;

    function getRewardAllocation(uint fundId) external view returns (uint);
}
