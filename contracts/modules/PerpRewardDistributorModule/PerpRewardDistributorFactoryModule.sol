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

    // --- Views --- //

    function getRewardId(uint128 poolId, address collateralType, address distributor) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, collateralType, distributor));
    }

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
        IPerpRewardDistributor(distributor).initialize(address(globalConfig.synthetix), data.token, data.name);

        emit RewardDistributorCreated(distributor);
        return distributor;
    }

    /**
     * @inheritdoc IPerpRewardDistributorFactoryModule
     */
    function registerRewardDistributor(
        IPerpRewardDistributorFactoryModule.RegsiterPerpRewardDistributorParameters calldata data
    ) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 length = data.collateralTypes.length;
        for (uint256 i = 0; i < length; ) {
            globalConfig.synthetix.registerRewardsDistributor(data.poolId, data.collateralTypes[i], data.distributor);

            unchecked {
                ++i;
            }
        }
    }
}
