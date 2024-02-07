// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ISynthetixCore} from "./interfaces/ISynthetixCore.sol";

contract RewardsDistributor is IRewardDistributor {
    address private rewardManager;
    uint128 public poolId;
    address public collateralType;
    string public name;

    bool public shouldFailPayout;

    constructor(
        address rewardManager_,
        uint128 poolId_,
        address collateralType_,
        string memory name_
    ) {
        rewardManager = rewardManager_; // Synthetix CoreProxy
        poolId = poolId_;
        collateralType = collateralType_;
        name = name_;
    }

    function token() public view returns (address) {
        return collateralType;
    }

    function setShouldFailPayout(bool shouldFailPayout_) external {
        if (msg.sender != ISynthetixCore(rewardManager).getPoolOwner(poolId)) {
            revert AccessError.Unauthorized(msg.sender);
        }
        shouldFailPayout = shouldFailPayout_;
    }

    function payout(
        uint128, // accountId,
        uint128, // poolId,
        address, // collateralType,
        address payoutTarget_, // msg.sender of claimRewards() call, payout target address
        uint256 payoutAmount_
    ) external returns (bool) {
        if (shouldFailPayout) {
            return false;
        }
        // IMPORTANT: In production, this function should revert if msg.sender is not the Synthetix CoreProxy address.
        if (msg.sender != rewardManager) {
            revert AccessError.Unauthorized(msg.sender);
        }
        IERC20(collateralType).transfer(payoutTarget_, payoutAmount_);
        return true;
    }

    function distributeRewards(
        uint128 poolId_,
        address collateralType_,
        uint256 amount_,
        uint64 start_,
        uint32 duration_
    ) public {
        if (msg.sender != ISynthetixCore(rewardManager).getPoolOwner(poolId)) {
            revert AccessError.Unauthorized(msg.sender);
        }
        if (poolId_ != poolId) {
            revert ParameterError.InvalidParameter("poolId", "Unexpected pool");
        }
        if (collateralType_ != collateralType) {
            revert ParameterError.InvalidParameter("collateralType", "Unexpected collateral");
        }
        ISynthetixCore(rewardManager).distributeRewards(
            poolId_,
            collateralType_,
            amount_,
            start_,
            duration_
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
