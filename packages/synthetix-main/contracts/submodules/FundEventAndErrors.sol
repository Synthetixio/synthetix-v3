//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundEventAndErrors {
    error FundAlreadyExists(uint fundId);
    error InvalidParameters(string incorrectParameter, string help);
    error FundAlreadyApproved(uint fundId);
    error FundNotFound(uint fundId);
    error OnlyTokenProxyAllowed(address origin);
    error EmptyVault(uint fundId, address collateralType);

    event FundCreated(address owner, uint256 fundId);
    event NominatedNewOwner(address nominatedOwner, uint256 fundId);
    event OwnershipAccepted(address newOwner, uint256 fundId);
    event OwnershipRenounced(address target, uint256 fundId);

    event PreferredFundSet(uint256 fundId);
    event FundApprovedAdded(uint256 fundId);
    event FundApprovedRemoved(uint256 fundId);

    event RewardDistributionSet(
        uint indexed fundId,
        address indexed token,
        uint indexed index,
        address distributor,
        uint totalRewarded,
        uint start,
        uint duration
    );
    event RewardsClaimed(uint indexed fundId, address indexed token, uint indexed accountId, uint index, uint amountClaimed);

    event FundPositionSet(uint fundId, uint[] markets, uint[] weights, address executedBy);
    event DelegationUpdated(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    );
}
