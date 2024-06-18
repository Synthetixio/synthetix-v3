//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {Price} from "@synthetixio/spot-market/contracts/storage/Price.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {Position} from "./Position.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {MarketUpdate} from "./MarketUpdate.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {GlobalPerpsMarket} from "./GlobalPerpsMarket.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {KeeperCosts} from "../storage/KeeperCosts.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {PerpsCollateralConfiguration} from "./PerpsCollateralConfiguration.sol";

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
    using PerpsCollateralConfiguration for PerpsCollateralConfiguration.Data;
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using KeeperCosts for KeeperCosts.Data;
    using AsyncOrder for AsyncOrder.Data;

    struct Data {
        // @dev synth marketId => amount
        mapping(uint128 => uint256) collateralAmounts;
        // @dev account Id
        uint128 id;
        // @dev set of active collateral types. By active we mean collateral types that have a non-zero amount
        SetUtil.UintSet activeCollateralTypes;
        // @dev set of open position market ids
        SetUtil.UintSet openPositionMarketIds;
        // @dev account's debt accrued from previous positions
        // @dev please use updateAccountDebt() to update this value which will update global debt also
        uint256 debt;
    }

    error InsufficientCollateralAvailableForWithdraw(
        int256 withdrawableMarginUsd,
        uint256 requestedMarginUsd
    );

    error InsufficientSynthCollateral(
        uint128 collateralId,
        uint256 collateralAmount,
        uint256 withdrawAmount
    );

    error InsufficientAccountMargin(uint256 leftover);

    error AccountLiquidatable(uint128 accountId);

    error AccountMarginLiquidatable(uint128 accountId);

    error MaxPositionsPerAccountReached(uint128 maxPositionsPerAccount);

    error MaxCollateralsPerAccountReached(uint128 maxCollateralsPerAccount);

    error NonexistentDebt(uint128 accountId);

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

    function validateMaxCollaterals(uint128 accountId, uint128 collateralId) internal view {
        Data storage account = load(accountId);

        if (account.collateralAmounts[collateralId] == 0) {
            uint128 maxCollateralsPerAccount = GlobalPerpsMarketConfiguration
                .load()
                .maxCollateralsPerAccount;
            if (maxCollateralsPerAccount <= account.activeCollateralTypes.length()) {
                revert MaxCollateralsPerAccountReached(maxCollateralsPerAccount);
            }
        }
    }

    /**
     * @notice This function charges the account the specified amount
     * @dev This is the only function that changes account debt.
     * @dev Excess credit is added to account's snxUSD amount.
     * @dev if the amount is positive, it is credit, if negative, it is debt.
     */
    function charge(Data storage self, int256 amount) internal returns (uint256 debt) {
        uint256 newDebt;
        if (amount > 0) {
            int256 leftoverDebt = self.debt.toInt() - amount;
            if (leftoverDebt > 0) {
                newDebt = leftoverDebt.toUint();
            } else {
                newDebt = 0;
                updateCollateralAmount(self, SNX_USD_MARKET_ID, -leftoverDebt);
            }
        } else {
            int256 creditAvailable = self.collateralAmounts[SNX_USD_MARKET_ID].toInt();
            int256 leftoverCredit = creditAvailable + amount;

            if (leftoverCredit > 0) {
                updateCollateralAmount(self, SNX_USD_MARKET_ID, amount);
            } else {
                updateCollateralAmount(self, SNX_USD_MARKET_ID, -creditAvailable);
                newDebt = (self.debt.toInt() - leftoverCredit).toUint();
            }
        }

        return updateAccountDebt(self, newDebt.toInt() - self.debt.toInt());
    }

    function updateAccountDebt(Data storage self, int256 amount) internal returns (uint256 debt) {
        self.debt = (self.debt.toInt() + amount).toUint();
        GlobalPerpsMarket.load().updateDebt(amount);

        return self.debt;
    }

    function isEligibleForMarginLiquidation(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    ) internal view returns (bool isEligible, int256 availableMargin) {
        availableMargin = getAvailableMargin(self, stalenessTolerance);
        isEligible = availableMargin < 0;
    }

    function isEligibleForLiquidation(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    )
        internal
        view
        returns (
            bool isEligible,
            int256 availableMargin,
            uint256 requiredInitialMargin,
            uint256 requiredMaintenanceMargin,
            uint256 liquidationReward
        )
    {
        availableMargin = getAvailableMargin(self, stalenessTolerance);

        (
            requiredInitialMargin,
            requiredMaintenanceMargin,
            liquidationReward
        ) = getAccountRequiredMargins(self, stalenessTolerance);
        isEligible = (requiredMaintenanceMargin + liquidationReward).toInt() > availableMargin;
    }

    function flagForLiquidation(
        Data storage self
    ) internal returns (uint256 flagKeeperCost, uint256 seizedMarginValue) {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        if (!liquidatableAccounts.contains(self.id)) {
            flagKeeperCost = KeeperCosts.load().getFlagKeeperCosts(self.id);
            liquidatableAccounts.add(self.id);
            seizedMarginValue = transferAllCollateral(self);
            AsyncOrder.load(self.id).reset();

            updateAccountDebt(self, -self.debt.toInt());
        }
    }

    function getMarginLiquidationCostAndSeizeMargin(
        Data storage self
    ) internal returns (uint256 marginLiquidateCost, uint256 seizedMarginValue) {
        // notice: using getFlagKeeperCosts here since the logic is the same, but with no positions.
        marginLiquidateCost = KeeperCosts.load().getFlagKeeperCosts(self.id);

        seizedMarginValue = transferAllCollateral(self);
    }

    function updateOpenPositions(
        Data storage self,
        uint256 positionMarketId,
        int256 size
    ) internal {
        if (size == 0 && self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.remove(positionMarketId);
        } else if (!self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.add(positionMarketId);
        }
    }

    function updateCollateralAmount(
        Data storage self,
        uint128 collateralId,
        int256 amountDelta
    ) internal returns (uint256 collateralAmount) {
        collateralAmount = (self.collateralAmounts[collateralId].toInt() + amountDelta).toUint();
        self.collateralAmounts[collateralId] = collateralAmount;

        bool isActiveCollateral = self.activeCollateralTypes.contains(collateralId);
        if (collateralAmount > 0 && !isActiveCollateral) {
            self.activeCollateralTypes.add(collateralId);
        } else if (collateralAmount == 0 && isActiveCollateral) {
            self.activeCollateralTypes.remove(collateralId);
        }

        // always update global values when account collateral is changed
        GlobalPerpsMarket.load().updateCollateralAmount(collateralId, amountDelta);
    }

    function payDebt(Data storage self, uint256 amount) internal {
        if (self.debt == 0) {
            revert NonexistentDebt(self.id);
        }

        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();
        perpsMarketFactory.synthetix.depositMarketUsd(
            perpsMarketFactory.perpsMarketId,
            ERC2771Context._msgSender(),
            amount
        );

        if (self.debt < amount) {
            self.debt = 0;
            updateCollateralAmount(self, SNX_USD_MARKET_ID, (amount - self.debt).toInt());
        } else {
            self.debt -= amount;
        }
    }

    /**
     * @notice This function validates you have enough margin to withdraw without being liquidated.
     * @dev    This is done by checking your collateral value against your initial maintenance value.
     * @dev    It also checks the synth collateral for this account is enough to cover the withdrawal amount.
     * @dev    All price checks are not checking strict staleness tolerance.
     */
    function validateWithdrawableAmount(
        Data storage self,
        uint128 collateralId,
        uint256 amountToWithdraw,
        ISpotMarketSystem spotMarket
    ) internal view {
        uint256 collateralAmount = self.collateralAmounts[collateralId];
        if (collateralAmount < amountToWithdraw) {
            revert InsufficientSynthCollateral(collateralId, collateralAmount, amountToWithdraw);
        }

        int256 withdrawableMarginUsd = getWithdrawableMargin(self, PerpsPrice.Tolerance.STRICT);
        // Note: this can only happen if account is liquidatable
        if (withdrawableMarginUsd < 0) {
            revert AccountLiquidatable(self.id);
        }

        uint256 amountToWithdrawUsd;
        if (collateralId == SNX_USD_MARKET_ID) {
            amountToWithdrawUsd = amountToWithdraw;
        } else {
            (amountToWithdrawUsd, ) = PerpsCollateralConfiguration.load(collateralId).valueInUsd(
                amountToWithdraw,
                spotMarket,
                PerpsPrice.Tolerance.STRICT,
                false
            );
        }

        if (amountToWithdrawUsd.toInt() > withdrawableMarginUsd) {
            revert InsufficientCollateralAvailableForWithdraw(
                withdrawableMarginUsd,
                amountToWithdrawUsd
            );
        }
    }

    /**
     * @notice Withdrawable amount depends on if the account has active positions or not
     * @dev    If the account has no active positions and no debt, the withdrawable margin is the total collateral value
     * @dev    If the account has no active positions but has debt, the withdrawable margin is the available margin (which is debt reduced)
     * @dev    If the account has active positions, the withdrawable margin is the available margin - required margin - potential liquidation reward
     */
    function getWithdrawableMargin(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    ) internal view returns (int256 withdrawableMargin) {
        bool hasActivePositions = hasOpenPositions(self);

        // not allowed to withdraw until debt is paid off fully.
        if (self.debt > 0) return 0;

        if (hasActivePositions) {
            (
                uint256 requiredInitialMargin,
                ,
                uint256 liquidationReward
            ) = getAccountRequiredMargins(self, stalenessTolerance);
            uint256 requiredMargin = requiredInitialMargin + liquidationReward;
            withdrawableMargin =
                getAvailableMargin(self, stalenessTolerance) -
                requiredMargin.toInt();
        } else {
            withdrawableMargin = getTotalCollateralValue(self, stalenessTolerance, false).toInt();
        }
    }

    function getTotalCollateralValue(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance,
        bool useDiscountedValue
    ) internal view returns (uint256) {
        uint256 totalCollateralValue;
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        for (uint256 i = 1; i <= self.activeCollateralTypes.length(); i++) {
            uint128 collateralId = self.activeCollateralTypes.valueAt(i).to128();
            uint256 amount = self.collateralAmounts[collateralId];

            uint256 amountToAdd;
            if (collateralId == SNX_USD_MARKET_ID) {
                amountToAdd = amount;
            } else {
                (amountToAdd, ) = PerpsCollateralConfiguration.load(collateralId).valueInUsd(
                    amount,
                    spotMarket,
                    stalenessTolerance,
                    useDiscountedValue
                );
            }
            totalCollateralValue += amountToAdd;
        }
        return totalCollateralValue;
    }

    function getAccountPnl(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    ) internal view returns (int256 totalPnl) {
        for (uint256 i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            (int256 pnl, , , , , ) = position.getPnl(
                PerpsPrice.getCurrentPrice(marketId, stalenessTolerance)
            );
            totalPnl += pnl;
        }
    }

    /**
     * @notice This function returns the available margin for an account (this is not withdrawable margin which takes into account, margin requirements for open positions)
     * @dev    The available margin is the total collateral value + account pnl - account debt
     * @dev    The total collateral value is always based on the discounted value of the collateral
     */
    function getAvailableMargin(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    ) internal view returns (int256) {
        int256 totalCollateralValue = getTotalCollateralValue(self, stalenessTolerance, true)
            .toInt();
        int256 accountPnl = getAccountPnl(self, stalenessTolerance);

        return totalCollateralValue + accountPnl - self.debt.toInt();
    }

    function getTotalNotionalOpenInterest(
        Data storage self
    ) internal view returns (uint256 totalAccountOpenInterest) {
        for (uint256 i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();

            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            uint256 openInterest = position.getNotionalValue(
                PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
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
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    )
        internal
        view
        returns (
            uint256 initialMargin,
            uint256 maintenanceMargin,
            uint256 possibleLiquidationReward
        )
    {
        uint256 openPositionMarketIdsLength = self.openPositionMarketIds.length();
        if (openPositionMarketIdsLength == 0) {
            return (0, 0, 0);
        }

        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        for (uint256 i = 1; i <= openPositionMarketIdsLength; i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                marketId
            );
            (, , uint256 positionInitialMargin, uint256 positionMaintenanceMargin) = marketConfig
                .calculateRequiredMargins(
                    position.size,
                    PerpsPrice.getCurrentPrice(marketId, stalenessTolerance)
                );

            maintenanceMargin += positionMaintenanceMargin;
            initialMargin += positionInitialMargin;
        }

        (
            uint256 accumulatedLiquidationRewards,
            uint256 maxNumberOfWindows
        ) = getKeeperRewardsAndCosts(self, 0);
        possibleLiquidationReward = getPossibleLiquidationReward(
            self,
            accumulatedLiquidationRewards,
            maxNumberOfWindows
        );

        return (initialMargin, maintenanceMargin, possibleLiquidationReward);
    }

    function getKeeperRewardsAndCosts(
        Data storage self,
        uint128 skipMarketId
    ) internal view returns (uint256 accumulatedLiquidationRewards, uint256 maxNumberOfWindows) {
        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        for (uint256 i = 1; i <= self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();
            if (marketId == skipMarketId) continue;
            Position.Data storage position = PerpsMarket.load(marketId).positions[self.id];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                marketId
            );

            uint256 numberOfWindows = marketConfig.numberOfLiquidationWindows(
                MathUtil.abs(position.size)
            );

            uint256 flagReward = marketConfig.calculateFlagReward(
                MathUtil.abs(position.size).mulDecimal(
                    PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
                )
            );
            accumulatedLiquidationRewards += flagReward;

            maxNumberOfWindows = MathUtil.max(numberOfWindows, maxNumberOfWindows);
        }
    }

    function getPossibleLiquidationReward(
        Data storage self,
        uint256 accumulatedLiquidationRewards,
        uint256 numOfWindows
    ) internal view returns (uint256 possibleLiquidationReward) {
        GlobalPerpsMarketConfiguration.Data storage globalConfig = GlobalPerpsMarketConfiguration
            .load();
        KeeperCosts.Data storage keeperCosts = KeeperCosts.load();
        uint256 costOfFlagging = keeperCosts.getFlagKeeperCosts(self.id);
        uint256 costOfLiquidation = keeperCosts.getLiquidateKeeperCosts();
        uint256 liquidateAndFlagCost = globalConfig.keeperReward(
            accumulatedLiquidationRewards,
            costOfFlagging,
            getTotalCollateralValue(self, PerpsPrice.Tolerance.DEFAULT, false)
        );
        uint256 liquidateWindowsCosts = numOfWindows == 0
            ? 0
            : globalConfig.keeperReward(0, costOfLiquidation, 0) * (numOfWindows - 1);

        possibleLiquidationReward = liquidateAndFlagCost + liquidateWindowsCosts;
    }

    function transferAllCollateral(
        Data storage self
    ) internal returns (uint256 seizedCollateralValue) {
        uint256[] memory activeCollateralTypes = self.activeCollateralTypes.values();

        for (uint256 i = 0; i < activeCollateralTypes.length; i++) {
            uint128 collateralId = activeCollateralTypes[i].to128();
            if (collateralId == SNX_USD_MARKET_ID) {
                seizedCollateralValue += self.collateralAmounts[collateralId];
            } else {
                // transfer to liquidation asset manager
                seizedCollateralValue += PerpsMarketFactory.load().transferLiquidatedSynth(
                    collateralId,
                    self.collateralAmounts[collateralId]
                );
            }

            updateCollateralAmount(
                self,
                collateralId,
                -(self.collateralAmounts[collateralId].toInt())
            );
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
            uint128 oldPositionAbsSize,
            MarketUpdate.Data memory marketUpdateData
        )
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        Position.Data storage position = perpsMarket.positions[self.id];

        perpsMarket.recomputeFunding(price);

        int128 oldPositionSize = position.size;
        oldPositionAbsSize = MathUtil.abs128(oldPositionSize);
        amountToLiquidate = perpsMarket.maxLiquidatableAmount(oldPositionAbsSize);

        if (amountToLiquidate == 0) {
            return (0, oldPositionSize, 0, oldPositionAbsSize, marketUpdateData);
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
                latestInterestAccrued: 0,
                size: newPositionSize
            });
        }

        // update position markets
        updateOpenPositions(self, marketId, newPositionSize);

        // update market data
        marketUpdateData = perpsMarket.updatePositionData(self.id, newPosition);
        sizeDelta = newPositionSize - oldPositionSize;

        return (
            amountToLiquidate,
            newPositionSize,
            sizeDelta,
            oldPositionAbsSize,
            marketUpdateData
        );
    }

    function hasOpenPositions(Data storage self) internal view returns (bool) {
        return self.openPositionMarketIds.length() > 0;
    }
}
