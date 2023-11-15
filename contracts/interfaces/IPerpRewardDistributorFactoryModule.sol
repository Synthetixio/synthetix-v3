//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";

interface IPerpRewardDistributorFactoryModule {
    // --- Structs --- //

    struct CreatePerpRewardDistributorParameters {
        // The pool the distributor will be registered with.
        uint128 poolId;
        // The collateral in the pool to be registered against.
        address collateralType;
        // Name of the distributor to be created e.g, ETHPERP Distributor.
        string name;
        // The reward ERC20 token this distributor is meant to distribute.
        address token;
    }

    // --- Events --- //

    // @notice Emitted when a distributor is created.
    event RewardDistributorCreated(uint128 id, bytes32 name);

    // --- Mutative --- //

    /**
     * @notice Creates (but does not register) a new RewardDistributor with Synthetix and initializes storage.
     */
    function createRewardDistributor(
        IPerpRewardDistributorFactoryModule.CreatePerpRewardDistributorParameters memory data
    ) external returns (bytes32 id, address rewardDistributor);
}
