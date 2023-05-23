//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {Position} from "./Position.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {LiquidationConfiguration} from "./LiquidationConfiguration.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";

uint128 constant SNX_USD_MARKET_ID = 0;

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
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using LiquidationConfiguration for LiquidationConfiguration.Data;
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
            if (isEligibleForLiquidation(self, accountId)) {
                flagForLiquidation(self, accountId);
            } else {
                revert IneligibleForLiquidation(availableCollateralUsd);
            }
        }
    }

    function isEligibleForLiquidation(
        Data storage self,
        uint128 accountId
    ) internal view returns (bool) {
        uint availableMargin = getAvailableMargin(self, accountId);
        uint liquidationMarginUsd = getAccountLiquidationAmount(self, accountId, 0, 0);

        return liquidationMarginUsd > availableMargin;
    }

    function flagForLiquidation(Data storage self, uint128 accountId) internal {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        if (!factory.liquidatableAccounts.contains(accountId)) {
            factory.liquidatableAccounts.add(accountId);
            convertAllCollateralToUsd(self, factory);
            self.flaggedForLiquidation = true;
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

    function addCollateralAmount(
        Data storage self,
        uint128 synthMarketId,
        uint amountToAdd
    ) internal {
        if (!self.activeCollateralTypes.contains(synthMarketId)) {
            self.activeCollateralTypes.add(synthMarketId);
        }

        self.collateralAmounts[synthMarketId] += amountToAdd;
    }

    function removeCollateralAmount(
        Data storage self,
        uint128 synthMarketId,
        uint amountToRemove
    ) internal {
        self.collateralAmounts[synthMarketId] -= amountToRemove;

        if (self.collateralAmounts[synthMarketId] == 0) {
            self.activeCollateralTypes.remove(synthMarketId);
        }
    }

    struct RuntimeLiquidationData {
        uint totalLosingPnl;
        uint totalLiquidationRewards;
        uint losingMarketsLength;
        uint profitableMarketsLength;
        uint128[] profitableMarkets;
        uint128[] losingMarkets;
        uint amountToDeposit;
        uint amountToLiquidatePercentage;
        uint percentageOfTotalLosingPnl;
        uint totalAvailableForDeposit;
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
            Position.Data storage position = PerpsMarket.load(positionMarketId).positions[
                accountId
            ];

            uint price = PerpsPrice.getCurrentPrice(positionMarketId);

            (, int totalPnl, , , ) = position.getPositionData(price);

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
            self.collateralAmounts[SNX_USD_MARKET_ID] += totalPnl.toUint();
            runtime.totalLiquidationRewards += liquidationReward;
            collectedPnlFromProfitableMarkets += (totalPnl.toUint() - liquidationReward);
        }

        // collateral balance = initial collateral balance + market withdrawn from profitable market
        uint totalAvailableUsd = accountCollateralValue + collectedPnlFromProfitableMarkets;

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

        for (uint i = 0; i < runtime.losingMarkets.length; i++) {
            uint128 positionMarketId = runtime.losingMarkets[i];

            (
                uint amountToLiquidate,
                int totalPnl,
                uint liquidationReward,
                Position.Data memory position
            ) = _processMarketLiquidation(self, positionMarketId, accountId);

            runtime.amountToLiquidatePercentage = amountToLiquidate.divDecimal(
                MathUtil.abs(position.size)
            );

            runtime.percentageOfTotalLosingPnl = MathUtil.abs(totalPnl).divDecimal(
                runtime.totalLosingPnl
            );
            runtime.totalAvailableForDeposit = totalAvailableUsd.mulDecimal(
                runtime.percentageOfTotalLosingPnl
            );

            runtime.amountToDeposit = runtime.totalAvailableForDeposit.mulDecimal(
                runtime.amountToLiquidatePercentage
            );

            runtime.amountToDeposit -= liquidationReward;
            runtime.totalLiquidationRewards += liquidationReward;

            factory.depositToMarketManager(positionMarketId, runtime.amountToDeposit);
            self.collateralAmounts[SNX_USD_MARKET_ID] -= runtime.amountToDeposit;
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
    ) internal view returns (uint) {
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
    ) internal view returns (uint) {
        (int totalAccountOpenInterest, uint accountMaxOpenInterest) = calculateOpenInterestValues(
            self,
            accountId
        );

        return (accountMaxOpenInterest.toInt() - totalAccountOpenInterest).toUint();
    }

    function calculateOpenInterestValues(
        Data storage self,
        uint128 accountId
    ) internal view returns (int totalAccountOpenInterest, uint accountMaxOpenInterest) {
        totalAccountOpenInterest = getTotalNotionalOpenInterest(self, accountId);

        uint totalCollateralValue = getTotalCollateralValue(self);

        uint maxLeverage = PerpsMarketFactory.load().maxLeverage;
        accountMaxOpenInterest = totalCollateralValue.mulDecimal(maxLeverage);
    }

    function getTotalNotionalOpenInterest(
        Data storage self,
        uint128 accountId
    ) internal view returns (int totalAccountOpenInterest) {
        for (uint i = 0; i < self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();

            Position.Data storage position = PerpsMarket.load(marketId).positions[accountId];
            (int openInterest, , , , ) = position.getPositionData(
                PerpsPrice.getCurrentPrice(marketId)
            );
            totalAccountOpenInterest += openInterest;
        }
    }

    function getTotalCollateralValue(Data storage self) internal view returns (uint) {
        uint totalCollateralValue;
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        for (uint i = 1; i <= self.activeCollateralTypes.length(); i++) {
            uint128 synthMarketId = self.activeCollateralTypes.valueAt(i).to128();
            uint amount = self.collateralAmounts[synthMarketId];

            uint amountToAdd;
            if (synthMarketId == SNX_USD_MARKET_ID) {
                amountToAdd = amount;
            } else {
                (amountToAdd, ) = spotMarket.quoteSellExactIn(synthMarketId, amount);
            }
            totalCollateralValue += amountToAdd;
        }
        return totalCollateralValue;
    }

    function getAccountPnl(
        Data storage self,
        uint128 accountId
    ) internal view returns (int totalPnl) {
        for (uint i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[accountId];
            (, int pnl, , , ) = position.getPositionData(PerpsPrice.getCurrentPrice(marketId));
            totalPnl += pnl;
        }
    }

    function getAvailableMargin(Data storage self, uint128 accountId) internal view returns (uint) {
        uint totalCollateralValue = getTotalCollateralValue(self);
        int accountPnl = getAccountPnl(self, accountId);

        return
            totalCollateralValue.toInt() < accountPnl
                ? 0
                : (totalCollateralValue.toInt() - accountPnl).toUint();
    }

    /**
     * @dev Returns the minimum amt of margin required before liquidation can occur
     * @dev If you send 0 for marketId, it will return liquidation amount for current open positions
     * @dev if marketId is specified, it will overwrite the account's open position with the position size specified.  Handy in situations where a new order is coming in
     */
    function getAccountLiquidationAmount(
        Data storage self,
        uint128 accountId,
        uint128 marketId,
        uint notionalPositionSize
    ) internal view returns (uint liquidationAmount) {
        for (uint i = 1; i <= self.activeCollateralTypes.length(); i++) {
            uint128 synthMarketId = self.activeCollateralTypes.valueAt(i).to128();
            if (synthMarketId == marketId) {
                continue;
            }

            Position.Data storage position = PerpsMarket.load(synthMarketId).positions[accountId];
            liquidationAmount += position.getLiquidationAmount();
        }

        if (marketId != 0) {
            // TODO: liquidation premium
            liquidationAmount += LiquidationConfiguration.load(marketId).liquidationMargin(
                notionalPositionSize
            );
        }
    }

    function convertAllCollateralToUsd(
        Data storage self,
        PerpsMarketFactory.Data storage factory
    ) internal {
        ISpotMarketSystem spotMarket = factory.spotMarket;
        for (uint i = 1; i < self.activeCollateralTypes.length(); i++) {
            uint128 synthMarketId = self.activeCollateralTypes.valueAt(i).to128();
            if (synthMarketId != SNX_USD_MARKET_ID) {
                uint amount = self.collateralAmounts[synthMarketId];
                // TODO what do we use for referer here/ min amount?
                (uint amountSold, ) = spotMarket.sellExactIn(synthMarketId, amount, 0, address(0));
                self.collateralAmounts[SNX_USD_MARKET_ID] += amountSold;
            }
        }
    }

    function deductFromAccount(
        Data storage self,
        uint amount // snxUSD
    ) internal {
        uint leftoverAmount = amount;
        uint128[] storage synthDeductionPriority = PerpsMarketFactory.load().synthDeductionPriority;
        for (uint i = 0; i < synthDeductionPriority.length; i++) {
            uint128 marketId = synthDeductionPriority[i];
            uint availableAmount = self.collateralAmounts[marketId];
            if (availableAmount == 0) {
                continue;
            }

            if (marketId == SNX_USD_MARKET_ID) {
                // snxUSD
                if (availableAmount >= leftoverAmount) {
                    self.collateralAmounts[marketId] = availableAmount - leftoverAmount;
                    leftoverAmount = 0;
                    break;
                } else {
                    self.collateralAmounts[marketId] = 0;
                    leftoverAmount -= availableAmount;
                }
            } else {
                // TODO: check if market is paused; if not, continue
                ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
                // TODO: sell $2 worth of synth
                (uint availableAmountUsd, ) = spotMarket.quoteSellExactIn(
                    marketId,
                    availableAmount
                );
                if (availableAmountUsd >= leftoverAmount) {
                    // TODO referer/max amt
                    (uint amountToDeduct, ) = spotMarket.sellExactOut(
                        marketId,
                        leftoverAmount,
                        type(uint).max,
                        address(0)
                    );
                    self.collateralAmounts[marketId] = availableAmount - amountToDeduct;
                    break;
                } else {
                    // TODO referer
                    (uint amountToDeduct, ) = spotMarket.sellExactIn(
                        marketId,
                        availableAmount,
                        0,
                        address(0)
                    );
                    self.collateralAmounts[marketId] = 0;
                    leftoverAmount -= amountToDeduct;
                }
            }
        }

        if (leftoverAmount > 0) {
            revert InsufficientMarginError(leftoverAmount);
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
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            positionMarketId
        );
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(positionMarketId);

        uint maxLiquidatableAmount = PerpsMarket.maxLiquidatableAmount(positionMarketId);

        Position.Data storage position = perpsMarket.positions[accountId];
        uint price = PerpsPrice.getCurrentPrice(positionMarketId);

        // in market units
        amountToLiquidate = MathUtil.min(maxLiquidatableAmount, MathUtil.abs(position.size));

        liquidationReward = MathUtil.min(
            marketConfig.maxLiquidationReward,
            amountToLiquidate.mulDecimal(marketConfig.liquidationRewardPercentage)
        );

        (, totalPnl, , , ) = position.getPositionData(price);

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
}
