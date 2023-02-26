//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./PerpsMarket.sol";

library Position {
    struct Data {
        uint128 marketId;
        int128 sizeDelta; // TODO: rename to size
        uint128 latestInteractionPrice;
        uint128 latestInteractionMargin;
        uint128 latestInteractionFunding;
    }

    function load(uint128 marketId, uint256 accountId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.AsyncOrder", marketId, accountId)
        );
        assembly {
            store.slot := s
        }
    }

    function marginPlusProfitFunding(Data storage self, uint price) internal view returns (int) {
        int funding = accruedFunding(self, price);
        return int(self.latestInteractionMargin).add(profitLoss(self, price)).add(funding);
    }

    function profitLoss(Data storage self, uint price) internal pure returns (int pnl) {
        int priceShift = int(price).sub(int(self.latestInteractionPrice));
        return int(self.sizeDelta).mulDecimal(priceShift);
    }

    function accruedFunding(Data storage self, uint price) internal view returns (int funding) {
        int net = netFundingPerUnit(self, price);
        return int(self.sizeDelta).mulDecimal(net);
    }

    function netFundingPerUnit(Data storage self, uint price) internal view returns (int) {
        // Compute the net difference between start and end indices.

        return nextFundingEntry(self, price).sub(self.latestInteractionFunding);
    }

    function nextFundingEntry(Data storage self, uint price) internal view returns (int) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(self.marketId);
        return int(perpsMarket.lastFundingValue).add(perpsMarket.unrecordedFunding(price));
    }
}
