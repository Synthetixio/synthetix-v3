//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IPerpRewardDistributor} from "@synthetixio/perps-reward-distributor/contracts/interfaces/IPerpsRewardDistributor.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {AddressUtil} from "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {Clones} from "../utils/Clones.sol";
import {IDistributorErrors} from "../interfaces/IDistributorErrors.sol";

/**
 * @title LiquidationAssetManager send liquidity to the reward distributor according to each collateral type
 */
library LiquidationAssetManager {
    using DecimalMath for uint256;
    using Clones for address;

    struct Data {
        /**
         * @dev Collateral Id (same as synth id)
         */
        uint128 id;
        /**
         * @dev Distributor address used for reward distribution. If address is 0x0, a new distributor will be created.
         */
        address distributor;
        /**
         * @dev Addresses of collateral types delegated to the pool. Used to distribute rewards.
         * @dev Needs to be manually maintained in synch with pool configuration to distribute proportionally to all LPs.
         */
        address[] poolDelegatedCollateralTypes;
    }

    function setValidPoolDelegatedCollateralTypes(
        Data storage self,
        address[] calldata poolDelegatedCollateralTypes
    ) internal {
        self.poolDelegatedCollateralTypes = poolDelegatedCollateralTypes;

        // Collaterals in a V3 pool can be delegated to a specific market. `collateralTypes` are the pool collateral
        // addresses delegated to this market. They're tracked here so downstream operations post creation can infer
        // pct of `token` to distribute amongst delegated collaterals. For example, during liquidation we calc to total
        // dollar value of delegated collateral and distribute the reward token proportionally to each collateral.
        //
        // There must be at least one pool collateral type available otherwise this reward distribute cannot distribute.
        uint256 collateralTypesLength = self.poolDelegatedCollateralTypes.length;
        if (collateralTypesLength == 0) {
            revert ParameterError.InvalidParameter("collateralTypes", "must not be empty");
        }
        for (uint256 i = 0; i < collateralTypesLength; ) {
            if (self.poolDelegatedCollateralTypes[i] == address(0)) {
                revert AddressError.ZeroAddress();
            }
            unchecked {
                ++i;
            }
        }
    }

    function setValidDistributor(Data storage self, address distributor) internal {
        if (distributor != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(
                    distributor,
                    type(IPerpRewardDistributor).interfaceId
                )
            ) {
                revert IDistributorErrors.InvalidDistributorContract(distributor);
            }

            // Reuse the previous distributor.
            self.distributor = distributor;
        } else {
            // Create a new distributor by cloning an existing implementation.
            self.distributor = GlobalPerpsMarketConfiguration
                .load()
                .rewardDistributorImplementation
                .clone();
        }
    }

    function distrubuteCollateral(Data storage self, address tokenAddres, uint256 amount) internal {
        IPerpRewardDistributor distributor = IPerpRewardDistributor(self.distributor);

        if (distributor.token() != tokenAddres) {
            revert IDistributorErrors.InvalidDistributor(self.id, tokenAddres);
        }

        uint256 poolCollateralTypesLength = self.poolDelegatedCollateralTypes.length;
        ISynthetixSystem synthetix = PerpsMarketFactory.load().synthetix;

        // Transfer collateral to the distributor
        ITokenModule(tokenAddres).transfer(self.distributor, amount);

        // Calculate the USD value of each collateral delegated to pool.
        uint128 poolId = distributor.getPoolId();
        uint256[] memory collateralValuesUsd = new uint256[](poolCollateralTypesLength);
        uint256 totalCollateralValueUsd;
        for (uint256 i = 0; i < poolCollateralTypesLength; ) {
            (, uint256 collateralValueUsd) = synthetix.getVaultCollateral(
                poolId,
                self.poolDelegatedCollateralTypes[i]
            );
            totalCollateralValueUsd += collateralValueUsd;
            collateralValuesUsd[i] = collateralValueUsd;

            unchecked {
                ++i;
            }
        }

        // Infer the ratio of size to distribute, proportional to value of each delegated collateral.
        uint256 remainingAmountToDistribute = amount;
        for (uint256 j = 0; j < poolCollateralTypesLength; ) {
            // Ensure total amounts fully distributed, the last collateral receives the remainder.
            if (j == poolCollateralTypesLength - 1) {
                distributor.distributeRewards(
                    self.poolDelegatedCollateralTypes[j],
                    remainingAmountToDistribute
                );
            } else {
                uint256 amountToDistribute = amount.mulDecimal(
                    collateralValuesUsd[j].divDecimal(totalCollateralValueUsd)
                );
                remainingAmountToDistribute -= amountToDistribute;
                distributor.distributeRewards(
                    self.poolDelegatedCollateralTypes[j],
                    amountToDistribute
                );
            }

            unchecked {
                ++j;
            }
        }
    }
}
