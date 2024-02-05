//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";

/**
 * @title Configuration of all multi collateral assets used for trader margin
 */
library CollateralConfiguration {
    struct Data {
        /**
         * @dev Collateral Id (same as synth id)
         */
        uint128 id;
        /**
         * @dev Max amount of collateral that can be used for margin
         */
        uint256 maxAmount;
        /**
         * @dev Collateral value is discounted and capped at this value.  In % units.
         */
        uint256 upperLimitDiscount;
        /**
         * @dev Collateral value is discounted and at minimum, this value.  In % units.
         */
        uint256 lowerLimitDiscount;
    }

    /**
     * @dev Load the collateral configuration data using collateral/synth id
     */
    function load(uint128 collateralId) internal pure returns (Data storage collateralConfig) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.CollateralConfiguration", collateralId)
        );
        assembly {
            collateralConfig.slot := s
        }
    }

    function setMax(Data storage self, uint128 synthId, uint256 maxAmount) internal {
        if (self.id == 0) self.id = synthId;
        self.maxAmount = maxAmount;
    }

    function isSupported(Data storage self) internal view returns (bool) {
        return self.maxAmount != 0;
    }

    function discountedValue(
        Data storage self,
        uint256 usdAmount,
        ISpotMarketSystem spotMarket
    ) internal view returns (uint256) {
        // TODO
        return usdAmount;
    }
}
