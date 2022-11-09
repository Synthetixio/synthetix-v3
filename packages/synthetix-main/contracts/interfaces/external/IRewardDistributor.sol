// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface an aggregator needs to adhere.
interface IRewardDistributor {
    /// called by system
    function payout(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        address sender,
        uint amount
    ) external returns (bool);
}
