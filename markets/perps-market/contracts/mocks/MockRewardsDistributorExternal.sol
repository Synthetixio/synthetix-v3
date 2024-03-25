//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {RewardsDistributorExternal as BaseRewardsDistributor} from "@synthetixio/rewards-distributor-external/src/RewardsDistributorExternal.sol";

// solhint-disable no-empty-blocks

/**
 * @title Mocked RewardsDistributorExternal.
 * See rewards-distributor-external/../RewardsDistributorExternal
 */
contract MockRewardsDistributorExternal is BaseRewardsDistributor {
    constructor(
        address rewardManager_,
        uint128 poolId_,
        address collateralType_,
        address payoutToken_,
        uint8 payoutTokenDecimals_,
        string memory name_,
        address authorizedExternalDistributor_
    )
        BaseRewardsDistributor(
            rewardManager_,
            poolId_,
            collateralType_,
            payoutToken_,
            payoutTokenDecimals_,
            name_,
            authorizedExternalDistributor_
        )
    {}
}
