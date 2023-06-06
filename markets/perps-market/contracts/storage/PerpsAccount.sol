//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {Position} from "./Position.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {GlobalPerpsMarket} from "./GlobalPerpsMarket.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
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
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using DecimalMath for int256;
    using DecimalMath for uint256;

    struct Data {
        // TODO: add account id to data so we don't have to pass it in
        // synth marketId => amount
        mapping(uint128 => uint256) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet openPositionMarketIds;
    }

    error InsufficientCollateralAvailableForWithdraw(uint available, uint required);

    error InsufficientMarginError(uint leftover);

    error AccountLiquidatable(uint128 accountId);

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));

        assembly {
            account.slot := s
        }
    }

    function isEligibleForLiquidation(
        Data storage self,
        uint128 accountId
    )
        internal
        view
        returns (bool isEligible, uint256 availableMargin, uint256 requiredMaintenanceMargin)
    {
        availableMargin = getAvailableMargin(self, accountId);

        if (self.openPositionMarketIds.length() == 0) {
            return (false, availableMargin, 0);
        }

        requiredMaintenanceMargin = getAccountMaintenanceMargin(self, accountId);
        isEligible = requiredMaintenanceMargin > availableMargin;
    }

    function flagForLiquidation(Data storage self, uint128 accountId) internal {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        if (!liquidatableAccounts.contains(accountId)) {
            liquidatableAccounts.add(accountId);
            convertAllCollateralToUsd(self);
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

    function withdrawCollateral(
        Data storage self,
        uint128 synthMarketId,
        uint amountToRemove
    ) internal {
        self.collateralAmounts[synthMarketId] -= amountToRemove;

        if (self.collateralAmounts[synthMarketId] == 0) {
            self.activeCollateralTypes.remove(synthMarketId);
        }
    }

    /**
     * @notice This function validates you have enough margin to withdraw without being liquidated.
     * @dev    This is done by checking your collateral value against your margin maintenance value.
     */
    function checkAvailableWithdrawableValue(
        Data storage self,
        uint128 accountId,
        uint256 amountToWithdraw
    ) internal view returns (uint256 availableWithdrawableCollateralUsd) {
        (
            bool isEligible,
            uint256 availableMargin,
            uint256 requiredMaintenanceMargin
        ) = isEligibleForLiquidation(self, accountId);

        if (isEligible) {
            revert AccountLiquidatable(accountId);
        }

        if (amountToWithdraw > availableWithdrawableCollateralUsd) {
            revert InsufficientCollateralAvailableForWithdraw(
                availableWithdrawableCollateralUsd,
                amountToWithdraw
            );
        }

        availableWithdrawableCollateralUsd = availableMargin - requiredMaintenanceMargin;
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
                : (totalCollateralValue.toInt() + accountPnl).toUint();
    }

    function getTotalNotionalOpenInterest(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint totalAccountOpenInterest) {
        for (uint i = 0; i < self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();

            Position.Data storage position = PerpsMarket.load(marketId).positions[accountId];
            (uint openInterest, , , , ) = position.getPositionData(
                PerpsPrice.getCurrentPrice(marketId)
            );
            totalAccountOpenInterest += openInterest;
        }
    }

    /**
     * @notice  This function returns the minimum margin an account requires to stay above liquidation threshold
     */
    function getAccountMaintenanceMargin(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint accountMaintenanceMargin) {
        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        uint256 accumulatedLiquidationRewards;
        for (uint i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[accountId];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                marketId
            );
            uint256 notionalValue = position.getNotionalValue(PerpsPrice.getCurrentPrice(marketId));
            (, , , uint256 positionMaintenanceMargin, uint256 liquidationMargin) = marketConfig
                .calculateRequiredMargins(notionalValue);

            accumulatedLiquidationRewards += liquidationMargin;
            accountMaintenanceMargin += positionMaintenanceMargin;
        }

        return
            accountMaintenanceMargin +
            GlobalPerpsMarketConfiguration.load().liquidationReward(accumulatedLiquidationRewards);
    }

    function convertAllCollateralToUsd(Data storage self) internal {
        for (uint i = 1; i < self.activeCollateralTypes.length(); i++) {
            uint128 synthMarketId = self.activeCollateralTypes.valueAt(i).to128();
            if (synthMarketId != SNX_USD_MARKET_ID) {
                uint amount = self.collateralAmounts[synthMarketId];
                // TODO what do we use for referer here/ min amount?
                (uint amountSold, ) = PerpsMarketFactory.load().spotMarket.sellExactIn(
                    synthMarketId,
                    amount,
                    0,
                    address(0)
                );
                self.collateralAmounts[SNX_USD_MARKET_ID] += amountSold;
            }
        }
    }

    function deductFromAccount(
        Data storage self,
        uint amount // snxUSD
    ) internal {
        uint leftoverAmount = amount;
        uint128[] storage synthDeductionPriority = GlobalPerpsMarketConfiguration
            .load()
            .synthDeductionPriority;
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
                    leftoverAmount = 0;
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

    struct RuntimeLiquidationData {
        uint totalLosingPnl;
        uint accumulatedLiquidationRewards;
        uint liquidationReward;
        uint losingMarketsLength;
        uint profitableMarketsLength;
        uint128[] profitableMarkets;
        uint128[] losingMarkets;
        uint amountToDeposit;
        uint amountToLiquidatePercentage;
        uint percentageOfTotalLosingPnl;
        uint totalAvailableForDeposit;
    }

    function liquidateAccount(Data storage self, uint128 accountId) internal {
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

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        for (uint i = 0; i < runtime.profitableMarkets.length; i++) {
            uint128 positionMarketId = runtime.profitableMarkets[i];
            (, int totalPnl, uint liquidationReward, ) = _processMarketLiquidation(
                self,
                positionMarketId,
                accountId
            );

            // withdraw from market
            uint256 amountToWithdraw = totalPnl.toUint() + liquidationReward;
            factory.synthetix.withdrawMarketUsd(positionMarketId, address(this), amountToWithdraw);
            self.collateralAmounts[SNX_USD_MARKET_ID] += amountToWithdraw;

            runtime.accumulatedLiquidationRewards += liquidationReward;
        }

        // remove liquidation rewards from total available usd to divvy up to losing positions
        uint totalAvailableUsd = self.collateralAmounts[SNX_USD_MARKET_ID] -
            runtime.accumulatedLiquidationRewards;

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
            runtime.accumulatedLiquidationRewards += liquidationReward;

            factory.depositToMarketManager(positionMarketId, runtime.amountToDeposit);
            self.collateralAmounts[SNX_USD_MARKET_ID] -= runtime.amountToDeposit;
        }

        // pay out liquidation rewards
        runtime.liquidationReward = GlobalPerpsMarketConfiguration.load().liquidationReward(
            runtime.accumulatedLiquidationRewards
        );
        factory.usdToken.transfer(msg.sender, runtime.liquidationReward);
    }

    function _processMarketLiquidation(
        Data storage self,
        uint128 positionMarketId,
        uint128 accountId
    )
        private
        returns (uint amountToLiquidate, int totalPnl, uint liquidationReward, Position.Data memory)
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(positionMarketId);

        uint maxLiquidatableAmount = PerpsMarket.maxLiquidatableAmount(positionMarketId);

        Position.Data storage position = perpsMarket.positions[accountId];
        uint price = PerpsPrice.getCurrentPrice(positionMarketId);

        // in market units
        amountToLiquidate = MathUtil.min(maxLiquidatableAmount, MathUtil.abs(position.size));

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

        // using amountToLiquidate to calculate liquidation reward
        (, , , , liquidationReward) = PerpsMarketConfiguration
            .load(positionMarketId)
            .calculateRequiredMargins(amountToLiquidate.mulDecimal(price));

        return (amountToLiquidate, totalPnl, liquidationReward, position);
    }
}
