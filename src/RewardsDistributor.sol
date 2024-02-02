// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

contract RewardsDistributor is IRewardDistributor {
    address private _rewardManager;
    address public token;
    string public name;

    bool public shouldFailPayout;

    constructor(address rewardManager_, address token_, string memory name_) {
        _rewardManager = rewardManager_; // Synthetix CoreProxy
        token = token_;
        name = name_;
    }

    function setShouldFailPayout(bool fail) external {
        shouldFailPayout = fail;
    }

    function payout(
        uint128, // accountId,
        uint128, // poolId,
        address, // collateralType,
        address sender, // msg.sender of claimRewards() call, payout target address
        uint256 amount
    ) external returns (bool) {
        // IMPORTANT: In production, this function should revert if msg.sender is not the Synthetix CoreProxy address.
        if (msg.sender != _rewardManager) {
            revert AccessError.Unauthorized(msg.sender);
        }
        IERC20(token).transfer(sender, amount);
        return !shouldFailPayout;
    }

    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint256 amount,
        uint64 start,
        uint32 duration
    ) public {
        IRewardsManagerModule(_rewardManager).distributeRewards(
            poolId,
            collateralType,
            amount,
            start,
            duration
        );
    }

    function onPositionUpdated(
        uint128, // accountId,
        uint128, // poolId,
        address, // collateralType,
        uint256 // actorSharesD18
    ) external {}

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IRewardDistributor).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
