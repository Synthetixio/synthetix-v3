//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IPerpRewardDistributor} from "@synthetixio/perps-reward-distributor/contracts/interfaces/IPerpsRewardDistributor.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

/**
 * @title LiquidationAssetManager send liquidity to the reward distributor according to each collateral type
 */
library LiquidationAssetManager {
    using DecimalMath for uint256;

    /**
     * @notice Thrown when attempting to access a not registered id
     */
    error InvalidId(uint128 id);

    /**
     * @notice Thrown when attempting to use a wrong distributor
     */
    error InvalidDistributor(uint128 id, address distributor);

    struct Data {
        /**
         * @dev Collateral Id (same as synth id)
         */
        uint128 id;
        /**
         * @dev TODO: add comment
         */
        address distributor;
        /**
         * @dev TODO: add comment
         */
        address[] collateralTypes;
    }

    /**
     * @dev Load the collateral configuration data using collateral/synth id
     */
    function load(uint128 collateralId) internal pure returns (Data storage collateralLAMConfig) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.LiquidationAssetManager", collateralId)
        );
        assembly {
            collateralLAMConfig.slot := s
        }
    }

    /**
     * @dev Load the collateral configuration data using collateral/synth id
     */
    function loadValid(
        uint128 collateralId
    ) internal view returns (Data storage collateralLAMConfig) {
        collateralLAMConfig = load(collateralId);
        if (collateralLAMConfig.id == 0) {
            revert InvalidId(collateralId);
        }
    }

    function distrubuteCollateral(Data storage self, address tokenAddres, uint256 amount) internal {
        IPerpRewardDistributor distributor = IPerpRewardDistributor(self.distributor);

        if (distributor.token() != tokenAddres) {
            revert InvalidDistributor(self.id, tokenAddres);
        }

        uint poolCollateralTypesLength = self.collateralTypes.length;
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
                self.collateralTypes[i]
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
                distributor.distributeRewards(self.collateralTypes[j], remainingAmountToDistribute);
            } else {
                uint256 amountToDistribute = amount.mulDecimal(
                    collateralValuesUsd[j].divDecimal(totalCollateralValueUsd)
                );
                remainingAmountToDistribute -= amountToDistribute;
                distributor.distributeRewards(self.collateralTypes[j], amountToDistribute);
            }

            unchecked {
                ++j;
            }
        }
    }
}
