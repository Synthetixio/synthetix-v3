// SPDX-License-Identifier: UNLICENSED
// solhint-disable meta-transactions/no-msg-sender
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {RewardsDistributor} from "@synthetixio/rewards-distributor/src/RewardsDistributor.sol";

contract RewardsDistributorExternal is RewardsDistributor {
    address public authorizedExternalDistributor;

    constructor(
        address rewardManager_,
        uint128 poolId_,
        address collateralType_,
        address payoutToken_,
        uint8 payoutTokenDecimals_,
        string memory name_,
        address authorizedExternalDistributor_
    )
        RewardsDistributor(
            rewardManager_,
            poolId_,
            collateralType_,
            payoutToken_,
            payoutTokenDecimals_,
            name_
        )
    {
        if (authorizedExternalDistributor_ == address(0)) {
            revert ParameterError.InvalidParameter(
                "authorizedExternalDistributor",
                "Invalid address"
            );
        }
        authorizedExternalDistributor = authorizedExternalDistributor_;
    }

    function _checkDistributeSender() internal view virtual override {
        if (msg.sender != authorizedExternalDistributor) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }
}
