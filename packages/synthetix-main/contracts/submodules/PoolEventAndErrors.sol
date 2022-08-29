//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PoolEventAndErrors {
    error PoolAlreadyExists(uint poolId);
    error InvalidParameters(string incorrectParameter, string help);
    error PoolAlreadyApproved(uint poolId);
    error PoolNotFound(uint poolId);
    error OnlyTokenProxyAllowed(address origin);
    error EmptyVault(uint poolId, address collateralType);

    event PoolCreated(address owner, uint256 poolId);
    event NominatedNewOwner(address nominatedOwner, uint256 poolId);
    event OwnershipAccepted(address newOwner, uint256 poolId);
    event OwnershipRenounced(address target, uint256 poolId);

    event PreferredPoolSet(uint256 poolId);
    event PoolApprovedAdded(uint256 poolId);
    event PoolApprovedRemoved(uint256 poolId);

    event RewardDistributionSet(
        uint indexed poolId,
        address indexed token,
        uint indexed index,
        address distributor,
        uint totalRewarded,
        uint start,
        uint duration
    );
    event RewardsClaimed(uint indexed poolId, address indexed token, uint indexed accountId, uint index, uint amountClaimed);

    event PoolPositionSet(uint poolId, uint[] markets, uint[] weights, address executedBy);
    event DelegationUpdated(uint accountId, uint poolId, address collateralType, uint amount, uint leverage);
}
