//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title LiquidationAssetManager send liquidity to the reward distributor according to each collateral type
 */
library LiquidationAssetManager {
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
}
