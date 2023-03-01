//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "../interfaces/external/ISpotMarketSystem.sol";
import "./Position.sol";
import "./PerpsMarket.sol";
import "../utils/MathUtil.sol";
import "./PerpsPrice.sol";
import "./MarketConfiguration.sol";

/**
 * @title Data for a single perps market
 */
library PerpsAccount {
    using SetUtil for SetUtil.UintSet;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using Position for Position.Data;
    using PerpsPrice for PerpsPrice.Data;
    using PerpsMarket for PerpsMarket.Data;
    using MarketConfiguration for MarketConfiguration.Data;
    using DecimalMath for int256;
    using DecimalMath for uint256;

    struct Data {
        // synth marketId => amount
        mapping(uint128 => uint) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet openPositionMarketIds;
        bool flaggedForLiquidation;
    }

    error InsufficientCollateralAvailableForWithdraw(uint available, uint required);

    error InsufficientMarginError(uint leftover);

    error IneligibleForLiquidation(uint availableCollateralUsd);

    error FlaggedForLiquidation();

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));

        assembly {
            account.slot := s
        }
    }

    function markForLiquidation(uint128 accountId) internal returns (uint availableCollateralUsd) {
        Data storage self = load(accountId);
        if (!self.flaggedForLiquidation) {
            availableCollateralUsd = getTotalCollateralValue(self);
            /*
                available collateral needs to take into consideration the liquidation premium & liquidation buffer for each market
                when calculating the pnl of each market to check against the total collateral value
            */
            if (availableCollateralUsd < 0) {
                PerpsMarketFactory.load().liquidatableAccounts.add(accountId);
                convertAllCollateralToUsd(self);
                self.flaggedForLiquidation = true;
            } else {
                revert IneligibleForLiquidation(availableCollateralUsd);
            }
        }
    }

    function checkLiquidationFlag(Data storage self) internal view {
        if (self.flaggedForLiquidation) {
            revert FlaggedForLiquidation();
        }
    }

    function updatePositionMarkets(Data storage self, uint positionMarketId, int size) internal {
        if (size == 0) {
            self.openPositionMarketIds.remove(positionMarketId);
        } else if (!self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.add(positionMarketId);
        }
    }

    function liquidateAccount(
        Data storage self,
        uint128 accountId,
        uint accountCollateralValue
    ) internal returns (uint amountToDeposit, uint liquidationRewards) {
        // loop through all positions
        // profitable / unprofitable

        // loop over profitable
        // close position if you can (maxLiquidatableValue)
        // withdraw from market keeper fee based on pnl that was liquidated
        // if not, break;

        // collateral balance = initial collateral balance + market withdrawn from profitable market
        // loop over losing positions,
        // -- in loop
        /*
            1. get the loss amount
            2. loss = find the min of loss, max liquidatable
            3. % = (loss * pnl) / all losing positions pnl
            4. colateral balance * % = value to deposit for that market
            5. withdraw from market keeper fee based on pnl that was liquidated
        */
        // ---

        // if collateral balance > 0 && losing positions closed
        // send it somewhere..

        uint totalOpenInterestValue = getTotalAccountOpenInterest(self, accountId);
        uint totalCollateralValue = getTotalCollateralValue(self);
        uint liquidatedUsd;

        for (uint i = 0; i < self.openPositionMarketIds.length(); i++) {
            uint128 positionMarketId = self.openPositionMarketIds.valueAt(i).to128();
            uint maxLiquidatableAmount = PerpsMarket.maxLiquidatableAmount(positionMarketId);

            PerpsMarket.Data storage perpsMarket = PerpsMarket.load(positionMarketId);

            Position.Data storage position = perpsMarket.positions[accountId];

            // in market units
            uint amountToLiquidate = MathUtil.min(
                maxLiquidatableAmount,
                MathUtil.abs(position.size)
            );

            // reduce position size
            position.size = position.size > 0
                ? position.size - amountToLiquidate.toInt().to128()
                : position.size + amountToLiquidate.toInt().to128();

            if (position.size == 0) {
                position.clear();
                self.openPositionMarketIds.remove(positionMarketId);
            }

            perpsMarket.updatePositionData(position);

            uint price = PerpsPrice.getCurrentPrice(positionMarketId);

            // recompute funding
            perpsMarket.recomputeFunding(price);

            uint amountToLiquidateUsd = price.mulDecimal(amountToLiquidate);
            uint amountToDepositPercentage = amountToLiquidateUsd.divDecimal(
                totalOpenInterestValue
            );

            liquidatedUsd += amountToLiquidateUsd;

            factory.synthetix.depositMarketUsd(amountToLiquidateUsd);

            // keeper fees
            liquidationRewards += MarketConfiguration
                .load(positionMarketId)
                .calculateSettlementReward(amountToLiquidateUsd);

            perpsMarket.lastUtilizedLiquidationCapacity += amountToLiquidate.to128();
        }

        // TODO: reset
        factory.usdToken.transfer(msg.sender, liquidationRewards);

        uint availableCollateralUsd = getTotalCollateralValue(self);

        amountToDeposit = liquidatedUsd > availableCollateralUsd
            ? availableCollateralUsd - liquidationRewards
            : liquidatedUsd - liquidationRewards;
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
    function checkAvailableWithdrawableValue(
        Data storage self,
        uint128 accountId,
        int amount
    ) internal returns (uint) {
        uint availableWithdrawableCollateralUsd = getAvailableWithdrawableCollateralUsd(
            self,
            accountId
        );
        if (availableWithdrawableCollateralUsd < MathUtil.abs(amount)) {
            revert InsufficientCollateralAvailableForWithdraw(
                availableWithdrawableCollateralUsd,
                MathUtil.abs(amount)
            );
        }
        return availableWithdrawableCollateralUsd;
    }

    function getAvailableWithdrawableCollateralUsd(
        Data storage self,
        uint128 accountId
    ) internal returns (uint) {
        int totalAccountOpenInterest = getTotalAccountOpenInterest(self);

        uint totalCollateralValue = getTotalCollateralValue(self);

        uint maxLeverage = PerpsMarketFactory.load().maxLeverage;
        uint accountMaxOpenInterest = totalCollateralValue.mulDecimal(maxLeverage);

        return (accountMaxOpenInterest.toInt() - totalAccountOpenInterest).toUint();
    }

    function getTotalAccountOpenInterest(
        Data storage self,
        uint128 accountId
    ) internal returns (int totalAccountOpenInterest) {
        for (uint i = 0; i < self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();

            Position.Data memory position = PerpsMarket.load(marketId).positions[accountId];
            (int marginProfitFunding, , , , ) = position.calculateExpectedPosition(
                PerpsPrice.getCurrentPrice(marketId)
            );
            totalAccountOpenInterest += marginProfitFunding;
        }
    }

    function getTotalCollateralValue(Data storage self) internal returns (uint) {
        uint totalCollateralValue;
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        for (uint i = 0; i < self.activeCollateralTypes.length(); i++) {
            uint128 synthMarketId = self.activeCollateralTypes.valueAt(i).to128();

            uint amount = self.collateralAmounts[synthMarketId];

            uint amountToAdd;
            if (synthMarketId == 0) {
                amountToAdd = amount;
            } else {
                (amountToAdd, ) = spotMarket.quoteSell(synthMarketId, amount);
            }
            totalCollateralValue += amountToAdd;
        }
        return totalCollateralValue;
    }

    function convertAllCollateralToUsd(Data storage self) internal {
        // sell it all
        // set activeCollateralTypes appropriately
    }

    function deductFromAccount(
        Data storage self,
        uint amount // snxUSD
    ) internal {
        uint leftoverAmount = amount;
        uint128[] storage deductionMarketOrder = PerpsMarketFactory.load().deductionMarketOrder;
        for (uint i = 0; i < deductionMarketOrder.length; i++) {
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
                ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
                // TODO: sell $2 worth of synth
                (uint availableAmountUsd, ) = spotMarket.quoteSell(marketId, availableAmount);
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

        if (leftoverAmount > 0) {
            revert InsufficientMarginError(leftoverAmount);
        }
    }
}
