//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IPerpRewardDistributorFactoryModule} from "../../interfaces/IPerpRewardDistributorFactoryModule.sol";
import {IPerpRewardDistributor} from "../../interfaces/IPerpRewardDistributor.sol";
import {PerpMarketConfiguration} from "../../storage/PerpMarketConfiguration.sol";

contract PerpRewardDistributorFactoryModule is IPerpRewardDistributorFactoryModule {
    using Clones for address;

    // --- Mutative --- //

    /**
     * @inheritdoc IPerpRewardDistributorFactoryModule
     */
    function createRewardDistributor(
        IPerpRewardDistributorFactoryModule.CreatePerpRewardDistributorParameters calldata data
    ) external returns (address) {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        address distributor = globalConfig.rewardDistributorImplementation.clone();
        IPerpRewardDistributor(distributor).initialize(
            address(globalConfig.synthetix),
            address(this),
            data.poolId,
            data.collateralTypes,
            data.token,
            data.name
        );

        emit RewardDistributorCreated(distributor);
        return distributor;
    }

    /**
     * @inheritdoc IPerpRewardDistributorFactoryModule
     */
    function registerRewardDistributor(IPerpRewardDistributor distributor) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        address[] memory poolCollateralTypes = distributor.getCollateralTypes();
        uint256 length = poolCollateralTypes.length;

        // TODO: Add a way to prevent registering non-IPerpRewardDistributors (i.e. distributors that
        // were not created via `createRewardDistributor`).

        for (uint256 i = 0; i < length; ) {
            globalConfig.synthetix.registerRewardsDistributor(
                distributor.getPoolId(),
                poolCollateralTypes[i],
                address(distributor)
            );

            unchecked {
                ++i;
            }
        }
    }
}
