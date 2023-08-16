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

    error MaxPositionsPerAccountReached(uint128 maxPositionsPerAccount);

    error MaxCollateralsPerAccountReached(uint128 maxCollateralsPerAccount);

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

    function validateMaxPositions(uint128 accountId, uint128 marketId) internal view {
        if (PerpsMarket.accountPosition(marketId, accountId).size == 0) {
            uint128 maxPositionsPerAccount = GlobalPerpsMarketConfiguration
                .load()
                .maxPositionsPerAccount;
            if (maxPositionsPerAccount <= load(accountId).openPositionMarketIds.length()) {
                revert MaxPositionsPerAccountReached(maxPositionsPerAccount);
            }
        }
    }

    function validateMaxCollaterals(uint128 accountId, uint128 synthMarketId) internal view {
        Data storage account = load(accountId);

        if (account.collateralAmounts[synthMarketId] == 0) {
            uint128 maxCollateralsPerAccount = GlobalPerpsMarketConfiguration
                .load()
                .maxCollateralsPerAccount;
            if (maxCollateralsPerAccount <= account.activeCollateralTypes.length()) {
                revert MaxCollateralsPerAccountReached(maxCollateralsPerAccount);
            }
        }
    }

    function isEligibleForLiquidation(
        Data storage self
    )
        internal
        view
        returns (
            bool isEligible,
            int256 availableMargin,
            uint256 requiredInitialMargin,
            uint256 requiredMaintenanceMargin,
            uint256 accumulatedLiquidationRewards,
            uint256 liquidationReward
        )
    {
        availableMargin = getAvailableMargin(self);
        if (self.openPositionMarketIds.length() == 0) {
            return (false, availableMargin, 0, 0, 0, 0);
        }
        (
            requiredInitialMargin,
            requiredMaintenanceMargin,
            accumulatedLiquidationRewards,
            liquidationReward
        ) = getAccountRequiredMargins(self);
        isEligible = (requiredMaintenanceMargin + liquidationReward).toInt() > availableMargin;
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
     * @dev    This is done by checking your collateral value against your initial maintenance value.
     */
    function validateWithdrawableAmount(
        Data storage self,
        uint256 amountToWithdraw
    ) internal view returns (uint256 availableWithdrawableCollateralUsd) {
        (
            bool isEligible,
            int256 availableMargin,
            uint256 initialRequiredMargin,
            ,
            ,
            uint256 liquidationReward
        ) = isEligibleForLiquidation(self);

        if (isEligible) {
            revert AccountLiquidatable(self.id);
        }

        uint256 requiredMargin = initialRequiredMargin + liquidationReward;
        // availableMargin can be assumed to be positive since we check for isEligible for liquidation prior
        availableWithdrawableCollateralUsd = availableMargin.toUint() - requiredMargin;

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
            (int pnl, , , , ) = position.getPnl(PerpsPrice.getCurrentPrice(marketId));
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
            (uint openInterest, , , , , ) = position.getPositionData(
                PerpsPrice.getCurrentPrice(marketId)
            );
            totalAccountOpenInterest += openInterest;
        }
    }

    /**
     * @notice  This function returns the required margins for an account
     * @dev The initial required margin is used to determine withdrawal amount and when opening positions
     * @dev The maintenance margin is used to determine when to liquidate a position
     */
    function getAccountRequiredMargins(
        Data storage self
    )
        internal
        view
        returns (
            uint initialMargin,
            uint maintenanceMargin,
            uint accumulatedLiquidationRewards,
            uint liquidationReward
        )
    {
        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        for (uint i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                marketId
            );
            (
                ,
                ,
                uint256 positionInitialMargin,
                uint256 positionMaintenanceMargin,
                uint256 liquidationMargin
            ) = marketConfig.calculateRequiredMargins(
                    position.size,
                    PerpsPrice.getCurrentPrice(marketId)
                );

            accumulatedLiquidationRewards += liquidationMargin;
            maintenanceMargin += positionMaintenanceMargin;
            initialMargin += positionInitialMargin;
        }

        // if account was liquidated, we account for liquidation reward that would be paid out to the liquidation keeper in required margin
        uint256 possibleLiquidationReward = GlobalPerpsMarketConfiguration.load().liquidationReward(
            accumulatedLiquidationRewards
        );

        return (
            initialMargin,
            maintenanceMargin,
            accumulatedLiquidationRewards,
            possibleLiquidationReward
        );
    }

    function convertAllCollateralToUsd(Data storage self) internal {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        uint[] memory activeCollateralTypes = self.activeCollateralTypes.values();

        // 1. withdraw all collateral from synthetix
        // 2. sell all collateral for snxUSD
        // 3. deposit snxUSD into synthetix
        for (uint256 i = 0; i < activeCollateralTypes.length; i++) {
            uint128 synthMarketId = activeCollateralTypes[i].to128();
            if (synthMarketId == SNX_USD_MARKET_ID) {
                updateCollateralAmount(
                    self,
                    synthMarketId,
                    -(self.collateralAmounts[synthMarketId].toInt())
                );
            } else {
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
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        ISpotMarketSystem spotMarket = factory.spotMarket;
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

                    factory.depositMarketUsd(leftoverAmount);

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

                    factory.depositMarketUsd(amountToDeductUsd);

                    updateCollateralAmount(self, marketId, -(availableAmount.toInt()));
                    leftoverAmount -= amountToDeductUsd;
                }
            }
        }

        if (leftoverAmount > 0) {
            revert InsufficientMarginError(leftoverAmount);
        }
    }

    function liquidatePosition(
        Data storage self,
        uint128 marketId,
        uint256 price
    )
        internal
        returns (
            uint128 amountToLiquidate,
            int128 newPositionSize,
            int128 sizeDelta,
            PerpsMarket.MarketUpdateData memory marketUpdateData
        )
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        Position.Data storage position = perpsMarket.positions[self.id];

        perpsMarket.recomputeFunding(price);

        int128 oldPositionSize = position.size;
        amountToLiquidate = perpsMarket.maxLiquidatableAmount(MathUtil.abs(oldPositionSize));

        if (amountToLiquidate == 0) {
            return (0, oldPositionSize, 0, marketUpdateData);
        }

        int128 amtToLiquidationInt = amountToLiquidate.toInt();
        // reduce position size
        newPositionSize = oldPositionSize > 0
            ? oldPositionSize - amtToLiquidationInt
            : oldPositionSize + amtToLiquidationInt;

        // create new position in case of partial liquidation
        Position.Data memory newPosition;
        if (newPositionSize != 0) {
            newPosition = Position.Data({
                marketId: marketId,
                latestInteractionPrice: price.to128(),
                latestInteractionFunding: perpsMarket.lastFundingValue.to128(),
                size: newPositionSize
            });
        }

        // update position markets
        updateOpenPositions(self, marketId, newPositionSize);

        // update market data
        marketUpdateData = perpsMarket.updatePositionData(self.id, newPosition);
        sizeDelta = position.size - oldPositionSize;

        return (amountToLiquidate, position.size, sizeDelta, marketUpdateData);
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
        factory.depositMarketUsd(amountUsd);

        // 4. update account collateral amount
        updateCollateralAmount(self, synthMarketId, -(amount.toInt()));
    }
}
