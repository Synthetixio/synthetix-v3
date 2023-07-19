//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {Position} from "./Position.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {AsyncOrder} from "./AsyncOrder.sol";
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
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using Position for Position.Data;
    using PerpsPrice for PerpsPrice.Data;
    using PerpsMarket for PerpsMarket.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using DecimalMath for int256;
    using DecimalMath for uint256;

    struct Data {
        // @dev synth marketId => amount
        mapping(uint128 => uint256) collateralAmounts;
        // @dev account Id
        uint128 id;
        // @dev set of active collateral types. By active we mean collateral types that have a non-zero amount
        SetUtil.UintSet activeCollateralTypes;
        // @dev set of open position market ids
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

    /**
        @notice allows us to update the account id in case it needs to be
     */
    function create(uint128 id) internal returns (Data storage account) {
        account = load(id);
        if (account.id == 0) {
            account.id = id;
        }
    }

    function isEligibleForLiquidation(
        Data storage self
    )
        internal
        view
        returns (bool isEligible, int256 availableMargin, uint256 requiredMaintenanceMargin)
    {
        availableMargin = getAvailableMargin(self);
        if (self.openPositionMarketIds.length() == 0) {
            return (false, availableMargin, 0);
        }
        requiredMaintenanceMargin = getAccountMaintenanceMargin(self);
        isEligible = requiredMaintenanceMargin.toInt() > availableMargin;
    }

    function flagForLiquidation(Data storage self) internal {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        if (!liquidatableAccounts.contains(self.id)) {
            liquidatableAccounts.add(self.id);
            convertAllCollateralToUsd(self);
        }
    }

    function updateOpenPositions(Data storage self, uint positionMarketId, int size) internal {
        if (size == 0 && self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.remove(positionMarketId);
        } else if (!self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.add(positionMarketId);
        }
    }

    function checkPendingOrder(Data storage self) internal view {
        // Check if there are pending orders
        AsyncOrder.Data memory asyncOrder = AsyncOrder.load(self.id);
        if (asyncOrder.sizeDelta != 0) {
            revert AsyncOrder.PendingOrderExist();
        }
    }

    function updateCollateralAmount(
        Data storage self,
        uint128 synthMarketId,
        int amountDelta
    ) internal returns (uint256 collateralAmount) {
        collateralAmount = (self.collateralAmounts[synthMarketId].toInt() + amountDelta).toUint();
        self.collateralAmounts[synthMarketId] = collateralAmount;

        bool isActiveCollateral = self.activeCollateralTypes.contains(synthMarketId);
        if (collateralAmount > 0 && !isActiveCollateral) {
            self.activeCollateralTypes.add(synthMarketId);
        } else if (collateralAmount == 0 && isActiveCollateral) {
            self.activeCollateralTypes.remove(synthMarketId);
        }

        // always update global values when account collateral is changed
        GlobalPerpsMarket.load().updateCollateralAmount(synthMarketId, amountDelta);
    }

    /**
     * @notice This function validates you have enough margin to withdraw without being liquidated.
     * @dev    This is done by checking your collateral value against your margin maintenance value.
     */
    function validateWithdrawableAmount(
        Data storage self,
        uint256 amountToWithdraw
    ) internal view returns (uint256 availableWithdrawableCollateralUsd) {
        (
            bool isEligible,
            int256 availableMargin,
            uint256 requiredMaintenanceMargin
        ) = isEligibleForLiquidation(self);

        if (isEligible) {
            revert AccountLiquidatable(self.id);
        }

        // availableMargin can be assumed to be positive since we check for isEligible for liquidation prior
        availableWithdrawableCollateralUsd = availableMargin.toUint() - requiredMaintenanceMargin;

        if (amountToWithdraw > availableWithdrawableCollateralUsd) {
            revert InsufficientCollateralAvailableForWithdraw(
                availableWithdrawableCollateralUsd,
                amountToWithdraw
            );
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

    function getAccountPnl(Data storage self) internal view returns (int totalPnl) {
        for (uint i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            (int pnl, , , ) = position.getPnl(PerpsPrice.getCurrentPrice(marketId));
            totalPnl += pnl;
        }
    }

    function getAvailableMargin(Data storage self) internal view returns (int256) {
        int256 totalCollateralValue = getTotalCollateralValue(self).toInt();
        int256 accountPnl = getAccountPnl(self);

        return totalCollateralValue + accountPnl;
    }

    function getTotalNotionalOpenInterest(
        Data storage self
    ) internal view returns (uint totalAccountOpenInterest) {
        for (uint i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();

            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
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
        Data storage self
    ) internal view returns (uint accountMaintenanceMargin) {
        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        uint256 accumulatedLiquidationRewards;
        for (uint i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                marketId
            );
            (, , , uint256 positionMaintenanceMargin, uint256 liquidationMargin) = marketConfig
                .calculateRequiredMargins(position.size, PerpsPrice.getCurrentPrice(marketId));

            accumulatedLiquidationRewards += liquidationMargin;
            accountMaintenanceMargin +=
                positionMaintenanceMargin +
                marketConfig.minimumPositionMargin;
        }

        return
            accountMaintenanceMargin +
            GlobalPerpsMarketConfiguration.load().liquidationReward(accumulatedLiquidationRewards);
    }

    function convertAllCollateralToUsd(Data storage self) internal {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        SetUtil.UintSet storage activeCollateralTypes = self.activeCollateralTypes;
        uint256 activeCollateralTypesLength = activeCollateralTypes.length();

        // 1. withdraw all collateral from synthetix
        // 2. sell all collateral for snxUSD
        // 3. deposit snxUSD into synthetix
        for (uint i = 1; i <= activeCollateralTypesLength; i++) {
            uint128 synthMarketId = activeCollateralTypes.valueAt(i).to128();
            if (synthMarketId != SNX_USD_MARKET_ID) {
                _deductAllSynth(self, factory, synthMarketId);
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
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        for (uint i = 0; i < synthDeductionPriority.length; i++) {
            uint128 marketId = synthDeductionPriority[i];
            uint availableAmount = self.collateralAmounts[marketId];
            if (availableAmount == 0) {
                continue;
            }

            if (marketId == SNX_USD_MARKET_ID) {
                // snxUSD
                if (availableAmount >= leftoverAmount) {
                    updateCollateralAmount(self, marketId, -(leftoverAmount.toInt()));
                    leftoverAmount = 0;
                    break;
                } else {
                    updateCollateralAmount(self, marketId, -(availableAmount.toInt()));
                    leftoverAmount -= availableAmount;
                }
            } else {
                (uint synthAmountRequired, ) = spotMarket.quoteSellExactOut(
                    marketId,
                    leftoverAmount
                );

                address synthToken = factory.spotMarket.getSynth(marketId);

                if (availableAmount >= synthAmountRequired) {
                    factory.synthetix.withdrawMarketCollateral(
                        factory.perpsMarketId,
                        synthToken,
                        synthAmountRequired
                    );

                    (uint amountToDeduct, ) = spotMarket.sellExactOut(
                        marketId,
                        leftoverAmount,
                        type(uint).max,
                        address(0)
                    );
                    // TODO: deposit snxUSD

                    updateCollateralAmount(self, marketId, -(amountToDeduct.toInt()));
                    leftoverAmount = 0;
                    break;
                } else {
                    factory.synthetix.withdrawMarketCollateral(
                        factory.perpsMarketId,
                        synthToken,
                        availableAmount
                    );

                    (uint amountToDeductUsd, ) = spotMarket.sellExactIn(
                        marketId,
                        availableAmount,
                        0,
                        address(0)
                    );
                    // TODO: deposit snxUSD

                    updateCollateralAmount(self, marketId, -(availableAmount.toInt()));
                    leftoverAmount -= amountToDeductUsd;
                }
            }
        }

        if (leftoverAmount > 0) {
            revert InsufficientMarginError(leftoverAmount);
        }
    }

    function liquidateAccount(Data storage self) internal returns (uint256 reward) {
        SetUtil.UintSet storage openPositionMarketIds = self.openPositionMarketIds;
        uint256 openPositionsLength = openPositionMarketIds.length();

        uint accumulatedLiquidationRewards;

        for (uint i = 1; i <= openPositionsLength; i++) {
            uint128 positionMarketId = openPositionMarketIds.valueAt(i).to128();
            PerpsMarket.Data storage perpsMarket = PerpsMarket.load(positionMarketId);
            Position.Data storage position = perpsMarket.positions[self.id];

            (, , uint liquidationReward, ) = _liquidatePosition(self, positionMarketId, position);
            accumulatedLiquidationRewards += liquidationReward;
        }

        reward = _processLiquidationRewards(accumulatedLiquidationRewards);
    }

    function _processLiquidationRewards(uint256 totalRewards) private returns (uint256 reward) {
        // pay out liquidation rewards
        reward = GlobalPerpsMarketConfiguration.load().liquidationReward(totalRewards);
        if (reward > 0) {
            PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
            factory.synthetix.withdrawMarketUsd(factory.perpsMarketId, msg.sender, reward);
        }
    }

    function _liquidatePosition(
        Data storage self,
        uint128 marketId,
        Position.Data storage position
    )
        private
        returns (
            uint128 amountToLiquidate,
            int totalPnl,
            uint liquidationReward,
            int128 oldPositionSize
        )
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);

        oldPositionSize = position.size;
        amountToLiquidate = perpsMarket.maxLiquidatableAmount(MathUtil.abs(oldPositionSize));
        uint price = PerpsPrice.getCurrentPrice(marketId);

        (, totalPnl, , , ) = position.getPositionData(price);

        int128 amtToLiquidationInt = amountToLiquidate.toInt();
        // reduce position size
        position.size = oldPositionSize > 0
            ? oldPositionSize - amtToLiquidationInt
            : oldPositionSize + amtToLiquidationInt;

        // update position markets
        updateOpenPositions(self, marketId, position.size);

        // update market data
        perpsMarket.updateMarketSizes(oldPositionSize, position.size);

        // using amountToLiquidate to calculate liquidation reward
        (, , , , liquidationReward) = PerpsMarketConfiguration
            .load(marketId)
            .calculateRequiredMargins(amtToLiquidationInt, price);
    }

    function _deductAllSynth(
        Data storage self,
        PerpsMarketFactory.Data storage factory,
        uint128 synthMarketId
    ) private {
        uint amount = self.collateralAmounts[synthMarketId];
        address synth = factory.spotMarket.getSynth(synthMarketId);

        // 1. withdraw collateral from market manager
        factory.synthetix.withdrawMarketCollateral(factory.perpsMarketId, synth, amount);

        // 2. sell collateral for snxUSD
        (uint amountUsd, ) = PerpsMarketFactory.load().spotMarket.sellExactIn(
            synthMarketId,
            amount,
            0,
            address(0)
        );

        // 3. deposit snxUSD into market manager
        factory.synthetix.depositMarketUsd(factory.perpsMarketId, address(this), amountUsd);

        // 4. update account collateral amount
        updateCollateralAmount(self, synthMarketId, -(amount.toInt()));
    }
}
