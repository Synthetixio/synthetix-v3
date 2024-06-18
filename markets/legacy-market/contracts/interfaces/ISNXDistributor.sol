//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Rewards distributor for sending snx inflation or liquidation proceeds to the preferred pool
 */
interface ISNXDistributor {
    function notifyRewardAmount(uint256 reward) external;
}
