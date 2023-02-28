//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "./PerpsMarket.sol";

library Position {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int128;
    using PerpsMarket for PerpsMarket.Data;

    struct Data {
        uint128 marketId;
        int128 size;
        uint128 latestInteractionPrice;
        uint128 latestInteractionMargin;
        int128 latestInteractionFunding;
    }

    function load(uint128 marketId, uint256 accountId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.AsyncOrder", marketId, accountId)
        );
        assembly {
            store.slot := s
        }
    }

    function updatePosition(Data storage self, Data memory newPosition) internal {
        self.size = newPosition.size;
        self.marketId = newPosition.marketId;
        self.latestInteractionPrice = newPosition.latestInteractionPrice;
        self.latestInteractionMargin = newPosition.latestInteractionMargin;
        self.latestInteractionFunding = newPosition.latestInteractionFunding;
    }

    function calculateExpectedPosition(
        Data storage self,
        uint price
    ) internal view returns (int, int, int, int, int) {
        return
            _calculateExpectedPosition(
                self.marketId,
                self.size,
                self.latestInteractionPrice,
                self.latestInteractionMargin,
                self.latestInteractionFunding,
                price
            );
    }

    function calculateExpectedPosition(
        Data memory self,
        uint price
    ) internal view returns (int, int, int, int, int) {
        return
            _calculateExpectedPosition(
                self.marketId,
                self.size,
                self.latestInteractionPrice,
                self.latestInteractionMargin,
                self.latestInteractionFunding,
                price
            );
    }

    function _calculateExpectedPosition(
        uint128 marketId,
        int128 size,
        uint128 latestInteractionPrice,
        uint128 latestInteractionMargin,
        int128 latestInteractionFunding,
        uint price
    )
        private
        view
        returns (
            int marginProfitFunding,
            int pnl,
            int accruedFunding,
            int netFundingPerUnit,
            int nextFunding
        )
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        nextFunding = perpsMarket.lastFundingValue + perpsMarket.unrecordedFunding(price);
        netFundingPerUnit = nextFunding - latestInteractionFunding;

        accruedFunding = size.mulDecimal(netFundingPerUnit);

        int priceShift = price.toInt() - latestInteractionPrice.toInt();
        pnl = size.mulDecimal(priceShift);

        marginProfitFunding = latestInteractionMargin.toInt() + pnl + accruedFunding;
    }
}
