
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

import "../../interfaces/external/IRewardDistributor.sol";
import "../../interfaces/IRewardDistributorModule.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../storage/RewardDistributorStorage.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "../../submodules/FundEventAndErrors.sol";

contract RewardDistributorModule is IRewardDistributorModule, IRewardDistributor, AssociatedSystemsMixin, OwnableMixin, RewardDistributorStorage {
    bytes32 private constant _REDEEMABLE_REWARDS_TOKEN = "eSNXToken";

    function setRewardAllocation(uint fundId, uint allocation) external override onlyOwner {
        _rewardDistributorStore().allocatedFunds[fundId] = allocation;
    }

    function getRewardAllocation(uint fundId) external override view returns (uint) {
        return _rewardDistributorStore().allocatedFunds[fundId];
    }

    function payout(
        uint fundId,
        address, // we dont care about/check the fund token
        address to,
        uint amount
    ) external override returns (bool) {
        // the address of this system is the only one that can call this function
        if (msg.sender != address(this)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        // fund must be approved in the core system
        if (_rewardDistributorStore().allocatedFunds[fundId] < amount) {
            revert AccessError.Unauthorized(msg.sender);
        }

        ITokenModule rewardToken = _getToken(_REDEEMABLE_REWARDS_TOKEN);

        _rewardDistributorStore().allocatedFunds[fundId] -= amount;
        rewardToken.mint(to, amount);
        

        return true;
    }
}
