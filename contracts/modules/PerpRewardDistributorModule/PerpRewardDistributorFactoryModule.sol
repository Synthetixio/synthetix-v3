//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IPerpRewardDistributorFactoryModule} from "../../interfaces/IPerpRewardDistributorFactoryModule.sol";
import {IPerpRewardDistributor} from "../../interfaces/IPerpRewardDistributor.sol";
import {PerpMarketConfiguration} from "../../storage/PerpMarketConfiguration.sol";
import {ErrorUtil} from "../../utils/ErrorUtil.sol";

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

        if (data.token == address(0)) {
            revert ErrorUtil.ZeroAddress();
        }

        uint256 collateralTypesLength = data.collateralTypes.length;
        if (collateralTypesLength == 0) {
            revert ErrorUtil.ZeroLength();
        }
        for (uint256 i = 0; i < collateralTypesLength; ) {
            if (data.collateralTypes[i] == address(0)) {
                revert ErrorUtil.ZeroAddress();
            }
            unchecked {
                ++i;
            }
        }

        // Create a new distributor by cloning an existing implementation.
        address distributorAddress = globalConfig.rewardDistributorImplementation.clone();
        IPerpRewardDistributor distributor = IPerpRewardDistributor(distributorAddress);
        distributor.initialize(
            address(globalConfig.synthetix),
            address(this),
            data.poolId,
            data.collateralTypes,
            data.token,
            data.name
        );

        emit RewardDistributorCreated(distributorAddress);
        return distributorAddress;
    }
}
