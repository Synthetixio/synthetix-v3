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
            (
                int totalAccountOpenInterest,
                uint accountMaxOpenInterest
            ) = _calculateOpenInterestValues(self, accountId);
            /*  TODO:
                available collateral needs to take into consideration the liquidation premium & liquidation buffer for each market
                when calculating the marginProfitFunding of each market to check against the total collateral value
            */
            if (totalAccountOpenInterest > accountMaxOpenInterest.toInt()) {
                flagForLiquidation(self, accountId);
            } else {
                revert IneligibleForLiquidation(availableCollateralUsd);
            }
        }
    }

    function flagForLiquidation(Data storage self, uint128 accountId) internal {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        factory.liquidatableAccounts.add(accountId);
        convertAllCollateralToUsd(self);
        self.flaggedForLiquidation = true;
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

    function _processMarketLiquidation(
        Data storage self,
        uint128 positionMarketId,
        uint128 accountId
    )
        private
        returns (uint amountToLiquidate, int totalPnl, uint liquidationReward, Position.Data memory)
    {
        MarketConfiguration.Data storage marketConfig = MarketConfiguration.load(positionMarketId);
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(positionMarketId);

        uint maxLiquidatableAmount = PerpsMarket.maxLiquidatableAmount(positionMarketId);

        Position.Data memory position = perpsMarket.positions[accountId];
        uint price = PerpsPrice.getCurrentPrice(positionMarketId);

        // in market units
        amountToLiquidate = MathUtil.min(maxLiquidatableAmount, MathUtil.abs(position.size));

        liquidationReward = MathUtil.min(
            marketConfig.maxLiquidationReward,
            amountToLiquidate.mulDecimal(marketConfig.liquidationRewardPercentage)
        );

        (, int pnl, int accruedFunding, , ) = position.calculateExpectedPosition(price);

        totalPnl = pnl + accruedFunding;

        // reduce position size
        position.size = position.size > 0
            ? position.size - amountToLiquidate.toInt().to128()
            : position.size + amountToLiquidate.toInt().to128();

        // update position markets
        updatePositionMarkets(self, positionMarketId, position.size);

        // if position is closed, remove from open position markets
        if (position.size == 0) {
            self.openPositionMarketIds.remove(positionMarketId);
        }

        return (amountToLiquidate, totalPnl, liquidationReward, position);
    }

    struct RuntimeLiquidationData {
        uint totalLosingPnl;
        uint totalLiquidationRewards;
        uint losingMarketsLength;
        uint profitableMarketsLength;
        uint128[] profitableMarkets;
        uint128[] losingMarkets;
    }

    function liquidateAccount(
        Data storage self,
        uint128 accountId,
        uint accountCollateralValue
    ) internal {
        RuntimeLiquidationData memory runtime;
        // loop through all positions
        // profitable / unprofitable
        runtime.profitableMarkets = new uint128[](self.openPositionMarketIds.length());
        runtime.losingMarkets = new uint128[](self.openPositionMarketIds.length());

        for (uint i = 0; i < self.openPositionMarketIds.length(); i++) {
            uint128 positionMarketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data memory position = PerpsMarket.load(positionMarketId).positions[accountId];

            uint price = PerpsPrice.getCurrentPrice(positionMarketId);

            (, int pnl, int accruedFunding, , ) = position.calculateExpectedPosition(price);

            int totalPnl = pnl + accruedFunding;

            if (totalPnl > 0) {
                runtime.profitableMarkets[runtime.profitableMarketsLength] = positionMarketId;
                runtime.profitableMarketsLength++;
            } else {
                runtime.losingMarkets[runtime.losingMarketsLength] = positionMarketId;
                runtime.losingMarketsLength++;
                runtime.totalLosingPnl += MathUtil.abs(totalPnl);
            }
        }

        // loop over profitable
        // close position if you can (maxLiquidatableValue)
        // withdraw from market keeper fee based on pnl that was liquidated
        // if not, break;

        uint collectedPnlFromProfitableMarkets;

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        for (uint i = 0; i < runtime.profitableMarkets.length; i++) {
            uint128 positionMarketId = runtime.profitableMarkets[i];
            (, int totalPnl, uint liquidationReward, ) = _processMarketLiquidation(
                self,
                positionMarketId,
                accountId
            );

            // withdraw from market
            factory.synthetix.withdrawMarketUsd(positionMarketId, address(this), totalPnl.toUint());
            self.collateralAmounts[0] += totalPnl.toUint();
            runtime.totalLiquidationRewards += liquidationReward;
            collectedPnlFromProfitableMarkets += (totalPnl.toUint() - liquidationReward);
        }

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

        uint totalAvailableUsd = accountCollateralValue + collectedPnlFromProfitableMarkets;

        for (uint i = 0; i < runtime.losingMarkets.length; i++) {
            uint128 positionMarketId = runtime.losingMarkets[i];

            (
                uint amountToLiquidate,
                int totalPnl,
                uint liquidationReward,
                Position.Data memory position
            ) = _processMarketLiquidation(self, positionMarketId, accountId);

            uint amountToLiquidatePercentage = amountToLiquidate.divDecimal(
                MathUtil.abs(position.size)
            );

            uint percentageOfTotalLosingPnl = MathUtil.abs(totalPnl).divDecimal(
                runtime.totalLosingPnl
            );
            uint totalAvailableForDeposit = totalAvailableUsd.mulDecimal(
                percentageOfTotalLosingPnl
            );

            uint amountToDeposit = totalAvailableForDeposit.mulDecimal(amountToLiquidatePercentage);

            amountToDeposit = amountToDeposit - liquidationReward;
            runtime.totalLiquidationRewards += liquidationReward;
            factory.synthetix.depositMarketUsd(positionMarketId, address(this), amountToDeposit);
        }

        factory.usdToken.transfer(msg.sender, runtime.totalLiquidationRewards);
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
        (int totalAccountOpenInterest, uint accountMaxOpenInterest) = _calculateOpenInterestValues(
            self,
            accountId
        );

        return (accountMaxOpenInterest.toInt() - totalAccountOpenInterest).toUint();
    }

    function _calculateOpenInterestValues(
        Data storage self,
        uint128 accountId
    ) private returns (int totalAccountOpenInterest, uint accountMaxOpenInterest) {
        totalAccountOpenInterest = getTotalAccountOpenInterest(self, accountId);

        uint totalCollateralValue = getTotalCollateralValue(self);

        uint maxLeverage = PerpsMarketFactory.load().maxLeverage;
        accountMaxOpenInterest = totalCollateralValue.mulDecimal(maxLeverage);
    }

    function getTotalAccountOpenInterest(
        Data storage self,
        uint128 accountId
    ) private returns (int totalAccountOpenInterest) {
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
