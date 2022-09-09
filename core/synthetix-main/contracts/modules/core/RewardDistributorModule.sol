//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

import "../../interfaces/external/IRewardDistributor.sol";
import "../../interfaces/IRewardDistributorModule.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../storage/RewardDistributorStorage.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

contract RewardDistributorModule is
    IRewardDistributorModule,
    IRewardDistributor,
    AssociatedSystemsMixin,
    OwnableMixin,
    RewardDistributorStorage
{
    bytes32 private constant _REDEEMABLE_REWARDS_TOKEN = "eSNXToken";

    error InsufficientRewardAllocation(uint requestedAmount, uint remainingAllocation);

    function setRewardAllocation(uint poolId, uint allocation) external override onlyOwner {
        _rewardDistributorStore().allocatedPools[poolId] = allocation;
    }

    function getRewardAllocation(uint poolId) external view override returns (uint) {
        return _rewardDistributorStore().allocatedPools[poolId];
    }

    function payout(
        uint poolId,
        address, // we dont care about/check the pool token
        address to,
        uint amount
    ) external override returns (bool) {
        // the address of this system is the only one that can call this function
        if (msg.sender != address(this)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        // pool must be approved in the core system
        if (_rewardDistributorStore().allocatedPools[poolId] < amount) {
            revert InsufficientRewardAllocation(amount, _rewardDistributorStore().allocatedPools[poolId]);
        }

        ITokenModule rewardToken = _getToken(_REDEEMABLE_REWARDS_TOKEN);

        _rewardDistributorStore().allocatedPools[poolId] -= amount;
        rewardToken.mint(to, amount);

        return true;
    }
}
