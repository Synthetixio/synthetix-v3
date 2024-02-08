//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";

import {LiquidationAssetManager} from "../storage/LiquidationAssetManager.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {Clones} from "../utils/Clones.sol";
import {IPerpRewardDistributor} from "@synthetixio/perps-reward-distributor/contracts/interfaces/IPerpsRewardDistributor.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";

/**
 * @title LiquidationAssetManagerModule send liquidity to the reward distributor according to each collateral type
 */
contract LiquidationAssetManagerModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using Clones for address;

    event RewardDistributorRegistered(address distributor);

    function registerDistributor(
        uint128 poolId,
        address token,
        string calldata name,
        uint128 collateralId,
        address[] calldata collateralTypes
    ) external returns (address) {
        OwnableStorage.onlyOwner();
        LiquidationAssetManager.Data storage lam = LiquidationAssetManager.load(collateralId);
        // clone distributor
        // LiquidationAssetManager.load(collateralId).distributor = distributor;
        lam.id = collateralId;
        lam.collateralTypes = collateralTypes;

        // A reward token to distribute must exist.
        if (token == address(0)) {
            revert AddressError.ZeroAddress();
        }

        // Collaterals in a V3 pool can be delegated to a specific market. `collateralTypes` are the pool collateral
        // addresses delegated to this market. They're tracked here so downstream operations post creation can infer
        // pct of `token` to distribute amongst delegated collaterals. For example, during liquidation we calc to total
        // dollar value of delegated collateral and distribute the reward token proportionally to each collateral.
        //
        // There must be at least one pool collateral type available otherwise this reward distribute cannot distribute.
        uint256 collateralTypesLength = collateralTypes.length;
        if (collateralTypesLength == 0) {
            revert ParameterError.InvalidParameter("collateralTypes", "must not be empty");
        }
        for (uint256 i = 0; i < collateralTypesLength; ) {
            if (collateralTypes[i] == address(0)) {
                revert AddressError.ZeroAddress();
            }
            unchecked {
                ++i;
            }
        }

        // Create a new distributor by cloning an existing implementation.
        lam.distributor = GlobalPerpsMarketConfiguration
            .load()
            .rewardDistributorImplementation
            .clone();

        IPerpRewardDistributor distributor = IPerpRewardDistributor(lam.distributor);
        distributor.initialize(
            address(PerpsMarketFactory.load().synthetix),
            address(this),
            poolId,
            token,
            name
        );

        emit RewardDistributorRegistered(lam.distributor);
        return lam.distributor;
    }

    function isRegistered(address distributor) external view returns (bool) {
        return distributor != address(0) && IPerpRewardDistributor(distributor).getPoolId() != 0;
    }

    function getRegisteredDistributor(
        uint128 collateralId
    ) external view returns (address distributor, address[] memory collateralTypes) {
        LiquidationAssetManager.Data storage lam = LiquidationAssetManager.load(collateralId);
        distributor = lam.distributor;
        collateralTypes = lam.collateralTypes;
    }
}
