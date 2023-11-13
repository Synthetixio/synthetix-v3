//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {PerpMarket} from "./PerpMarket.sol";

library GlobalPerpMarket {
    struct Data {
        // Array of supported synth spot market ids useable as collateral for margin.
        uint128[] activeMarketIds;
    }
    bytes32 private constant SLOT_NAME = keccak256(abi.encode("io.synthetix.bfp-market.GlobalPerpMarket"));

    function load() internal pure returns (GlobalPerpMarket.Data storage d) {
        bytes32 s = SLOT_NAME;

        assembly {
            d.slot := s
        }
    }

    function getTotalCollateralAmounts(
        GlobalPerpMarket.Data storage self,
        uint128 synthMarketId
    ) internal view returns (uint256) {
        uint128[] memory activeMarketIds = self.activeMarketIds;

        uint256 activeMarketIdsLength = activeMarketIds.length;
        uint256 totalCollateralAmount;
        // Accumulate collateral amounts for active markets
        for (uint256 i = 0; i < activeMarketIdsLength; i++) {
            uint128 marketId = activeMarketIds[i];
            PerpMarket.Data storage market = PerpMarket.load(marketId);

            totalCollateralAmount += market.depositedCollateral[synthMarketId];
        }
        return totalCollateralAmount;
    }
}
