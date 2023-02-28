//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "./Position.sol";

/**
 * @title Data for a single perps market
 */
library PerpsAccount {
    struct Data {
        // synth marketId => amount
        mapping(uint128 => uint) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet openPositionMarketIds;
    }

    error InsufficientCollateralAvailableForWithdraw(uint available, uint required);

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));

        assembly {
            account.slot := s
        }
    }

    function updatePositionMarket(Data storage self, uint positionMarketId, int size) internal {
        if (size == 0) {
            self.openPositionMarketIds.remove(positionMarketId);
        } else if (!self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.add(positionMarketId);
        }
    }

    // Checks current collateral amounts
    function checkAvailableCollateralAmount(
        Data storage self,
        uint128 collateralType,
        uint amount
    ) internal view {
        uint availableAmount = self.collateralAmounts[collateralType];
        if (availableAmount < amount) {
            revert InsufficientCollateralAvailableForWithdraw(availableAmount, amount);
        }
    }

    // Checks available withdrawable value across all positions
    function checkAvailableWithdrawalValue(
        Data storage self,
        int amount
    ) internal view returns (uint) {
        uint availableWithdrawableCollateralUsd = getAvailableWithdrawableCollateralUsd(self);
        if (availableWithdrawableValue < MathUtil.abs(amount)) {
            revert InsufficientCollateralAvailableForWithdraw(
                availableWithdrawableValue,
                MathUtil.abs(amount)
            );
        }
        return availableWithdrawableCollateralUsd;
    }

    function getAvailableWithdrawableCollateralUsd(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint) {
        int totalAccountOpenInterest;
        for (int i = 0; i < self.openPositionMarketIds.length; i++) {
            uint marketId = self.openPositionMarketIds.get(i);

            (int marginProfitFunding, , , , ) = Position
                .load(marketId, accountId)
                .calculateExpectedPosition(Price.getCurrentPrice(marketId));
            totalAccountOpenInterest += marginProfitFunding;
        }
        uint totalCollateralValue;

        IAtomicOrderModule storage spotMarket = PerpsMarketFactory.load().spotMarket;
        for (int i = 0; i < self.activeCollateralTypes.length; i++) {
            uint synthMarketId = self.activeCollateralTypes.get(i);

            uint amount = self.collateralAmounts[collateralType];

            totalCollateralValue += synthMarketId == 0
                ? amount
                : spotMarket.quoteSell(synthMarketId, amount);
        }
        uint maxLeverage = PerpsMarketFactory.load().maxLeverage;
        uint accountMaxOpenInterest = totalCollateralValue.mulDecimal(maxLeverage);

        return accountMaxOpenInterest - totalAccountOpenInterest;
    }

    function deductFromAccount(
        Data storage self,
        uint amount // snxUSD
    ) internal {
        uint leftoverAmount = amount;
        for (int i = 0; i < PerpsMarketFactory.load().deductionMarketOrder; i++) {
            uint128 marketId = deductionMarketOrder[i];
            uint availableAmount = self.collateralAmounts[marketId];
            if (availableAmount == 0) {
                continue;
            }

            if (marketId == 0) {
                // snxUSD
                if (availableAmount >= leftoverAmount) {
                    self.collateralAmounts[marketId] = availableAmount - leftoverAmount;
                    break;
                } else {
                    self.collateralAmounts[marketId] = 0;
                    leftoverAmount -= availableAmount;
                }
            } else {
                // TODO: check if market is paused; if not, continue
                IAtomicOrderModule storage spotMarket = PerpsMarketFactory.load().spotMarket;
                // TODO: sell $2 worth of synth
                uint availableAmountUsd = spotMarket.quoteSell(marketId, availableAmount);
                if (availableAmountUsd >= leftoverAmount) {
                    uint amountToDeduct = spotMarket.sellExactOut(marketId, leftoverAmount);
                    self.collateralAmounts[marketId] = availableAmount - amountToDeduct;
                    break;
                } else {
                    uint amountToDeduct = spotMarket.sellExactIn(marketId, availableAmount);
                    self.collateralAmounts[marketId] = 0;
                    leftoverAmount -= amountToDeduct;
                }
            }
        }

        if (leftoverFees > 0) {
            revert InsufficientMarginError(leftoverFees);
        }
    }
}
