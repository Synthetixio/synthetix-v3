//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
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
        // @dev indicates the types of orders that this account can make
        bytes16 orderMode;
        uint128 orderModeChangeTime;
    }

    struct MemoryContext {
        uint128 accountId;
        PerpsPrice.Tolerance stalenessTolerance;
        Position.Data[] positions;
        uint256[] prices;
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

    uint256 constant ORDER_MODE_CHANGE_GRACE_PERIOD = 180; // 3 minutes

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));

        assembly {
            account.slot := s
        }
    }

    /**
     * @notice allows us to update the account id in case it needs to be
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
            // Adding credit
            int256 leftoverDebt = self.debt.toInt() - amount;
            if (leftoverDebt > 0) {
                newDebt = leftoverDebt.toUint();
            } else {
                newDebt = 0;
                updateCollateralAmount(self, SNX_USD_MARKET_ID, -leftoverDebt);
            }
        } else {
            // Adding debt
            int256 creditAvailable = self.collateralAmounts[SNX_USD_MARKET_ID].toInt();
            int256 leftoverCredit = creditAvailable + amount;

            if (leftoverCredit > 0) {
                updateCollateralAmount(self, SNX_USD_MARKET_ID, amount);
                newDebt = self.debt;
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
        MemoryContext memory ctx,
        uint256 totalCollateralValueWithDiscount,
        uint256 totalCollateralValueWithoutDiscount
    ) internal view returns (bool isEligible, int256 availableMargin) {
        // calculate keeper costs
        KeeperCosts.Data storage keeperCosts = KeeperCosts.load();
        uint256 totalLiquidationCost = keeperCosts.getFlagKeeperCosts(ctx.accountId) +
            keeperCosts.getLiquidateKeeperCosts();

        GlobalPerpsMarketConfiguration.Data storage globalConfig = GlobalPerpsMarketConfiguration
            .load();
        uint256 liquidationRewardForKeeper = globalConfig.calculateCollateralLiquidateReward(
            totalCollateralValueWithoutDiscount
        );

        int256 totalLiquidationReward = globalConfig
            .keeperReward(
                liquidationRewardForKeeper,
                totalLiquidationCost,
                totalCollateralValueWithoutDiscount
            )
            .toInt();

        availableMargin =
            getAvailableMargin(ctx, totalCollateralValueWithDiscount) -
            totalLiquidationReward;
        isEligible = availableMargin < 0 && PerpsAccount.load(ctx.accountId).debt > 0;
    }

    function isEligibleForLiquidation(
        MemoryContext memory ctx,
        uint256 totalCollateralValueWithDiscount,
        uint256 totalCollateralValueWithoutDiscount
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
        availableMargin = getAvailableMargin(ctx, totalCollateralValueWithDiscount);

        (
            requiredInitialMargin,
            requiredMaintenanceMargin,
            liquidationReward
        ) = getAccountRequiredMargins(ctx, totalCollateralValueWithoutDiscount);
        isEligible = (requiredMaintenanceMargin + liquidationReward).toInt() > availableMargin;
    }

    function flagForLiquidation(
        Data storage self
    ) internal returns (uint256 flagKeeperCost, uint256 seizedMarginValue) {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        if (!liquidatableAccounts.contains(self.id)) {
            flagKeeperCost = KeeperCosts.load().getFlagKeeperCosts(
                getNumberOfUpdatedFeedsRequired(self)
            );
            liquidatableAccounts.add(self.id);
            seizedMarginValue = seizeCollateral(self);

            // clean pending orders
            AsyncOrder.load(self.id).reset();

            updateAccountDebt(self, -self.debt.toInt());
        }
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

    function payDebt(Data storage self, uint256 amount) internal returns (uint256 debtPaid) {
        if (self.debt == 0) {
            revert NonexistentDebt(self.id);
        }

        /*
            1. if the debt is less than the amount, set debt to 0 and only deposit debt amount
            2. if the debt is more than the amount, subtract the amount from the debt
            3. excess amount is ignored
        */

        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();

        debtPaid = MathUtil.min(self.debt, amount);
        updateAccountDebt(self, -debtPaid.toInt());

        perpsMarketFactory.synthetix.depositMarketUsd(
            perpsMarketFactory.perpsMarketId,
            ERC2771Context._msgSender(),
            debtPaid
        );
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

        MemoryContext memory ctx = getOpenPositionsAndCurrentPrices(
            self,
            PerpsPrice.Tolerance.STRICT
        );
        (
            uint256 totalCollateralValueWithDiscount,
            uint256 totalCollateralValueWithoutDiscount
        ) = getTotalCollateralValue(self, PerpsPrice.Tolerance.DEFAULT);

        int256 withdrawableMarginUsd = getWithdrawableMargin(
            ctx,
            totalCollateralValueWithoutDiscount,
            totalCollateralValueWithDiscount
        );
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
                PerpsPrice.Tolerance.STRICT
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
        MemoryContext memory ctx,
        uint256 totalNonDiscountedCollateralValue,
        uint256 totalDiscountedCollateralValue
    ) internal view returns (int256 withdrawableMargin) {
        PerpsAccount.Data storage account = load(ctx.accountId);
        bool hasActivePositions = hasOpenPositions(account);

        // not allowed to withdraw until debt is paid off fully.
        if (account.debt > 0) return 0;

        if (hasActivePositions) {
            (
                uint256 requiredInitialMargin,
                ,
                uint256 liquidationReward
            ) = getAccountRequiredMargins(ctx, totalNonDiscountedCollateralValue);
            uint256 requiredMargin = requiredInitialMargin + liquidationReward;
            withdrawableMargin =
                getAvailableMargin(ctx, totalDiscountedCollateralValue) -
                requiredMargin.toInt();
        } else {
            withdrawableMargin = totalNonDiscountedCollateralValue.toInt();
        }
    }

    function getTotalCollateralValue(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    ) internal view returns (uint256 discounted, uint256 nonDiscounted) {
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        for (uint256 i = 1; i <= self.activeCollateralTypes.length(); i++) {
            uint128 collateralId = self.activeCollateralTypes.valueAt(i).to128();
            uint256 amount = self.collateralAmounts[collateralId];

            if (collateralId == SNX_USD_MARKET_ID) {
                discounted += amount;
                nonDiscounted += amount;
            } else {
                (uint256 value, uint256 discount) = PerpsCollateralConfiguration
                    .load(collateralId)
                    .valueInUsd(amount, spotMarket, stalenessTolerance);
                nonDiscounted += value;
                discounted += value.mulDecimal(DecimalMath.UNIT - discount);
            }
        }
    }

    /**
     * @notice Retrieves current open positions and their corresponding market prices (given staleness tolerance) for the given account.
     * These values are required inputs to many functions below.
     */
    function getOpenPositionsAndCurrentPrices(
        Data storage self,
        PerpsPrice.Tolerance stalenessTolerance
    ) internal view returns (MemoryContext memory ctx) {
        uint256[] memory marketIds = self.openPositionMarketIds.values();
        uint128 accountId = self.id;
        ctx = MemoryContext(
            self.id,
            stalenessTolerance,
            new Position.Data[](marketIds.length),
            PerpsPrice.getCurrentPrices(marketIds, stalenessTolerance)
        );
        for (uint256 i = 0; i < ctx.positions.length; i++) {
            ctx.positions[i] = PerpsMarket.load(marketIds[i].to128()).positions[accountId];
        }
    }

    function findPositionByMarketId(
        MemoryContext memory ctx,
        uint128 marketId
    ) internal pure returns (uint256 i) {
        for (; i < ctx.positions.length; i++) {
            if (ctx.positions[i].marketId == marketId) {
                break;
            }
        }
    }

    function upsertPosition(
        MemoryContext memory ctx,
        Position.Data memory newPosition
    ) internal view returns (MemoryContext memory newCtx) {
        uint256 oldPositionPos = PerpsAccount.findPositionByMarketId(ctx, newPosition.marketId);
        if (oldPositionPos < ctx.positions.length) {
            ctx.positions[oldPositionPos] = newPosition;
            newCtx = ctx;
        } else {
            // we have to expand the size of the array
            newCtx = MemoryContext(
                ctx.accountId,
                ctx.stalenessTolerance,
                new Position.Data[](ctx.positions.length + 1),
                new uint256[](ctx.positions.length + 1)
            );
            for (uint256 i = 0; i < ctx.positions.length; i++) {
                newCtx.positions[i] = ctx.positions[i];
                newCtx.prices[i] = ctx.prices[i];
            }
            newCtx.positions[ctx.positions.length] = newPosition;
            newCtx.prices[ctx.positions.length] = PerpsPrice.getCurrentPrice(
                newPosition.marketId,
                ctx.stalenessTolerance
            );
        }
    }

    function getAccountPnl(MemoryContext memory ctx) internal view returns (int256 totalPnl) {
        for (uint256 i = 0; i < ctx.positions.length; i++) {
            (int256 pnl, , , , , ) = ctx.positions[i].getPnl(ctx.prices[i]);
            totalPnl += pnl;
        }
    }

    /**
     * @notice This function returns the available margin for an account (this is not withdrawable margin which takes into account, margin requirements for open positions)
     * @dev    The available margin is the total collateral value + account pnl - account debt
     * @dev    The total collateral value is always based on the discounted value of the collateral
     */
    function getAvailableMargin(
        MemoryContext memory ctx,
        uint256 totalCollateralValueWithDiscount
    ) internal view returns (int256) {
        int256 accountPnl = getAccountPnl(ctx);

        return
            totalCollateralValueWithDiscount.toInt() +
            accountPnl -
            load(ctx.accountId).debt.toInt();
    }

    function getTotalNotionalOpenInterest(
        MemoryContext memory ctx
    ) internal pure returns (uint256 totalAccountOpenInterest) {
        for (uint256 i = 0; i < ctx.positions.length; i++) {
            uint256 openInterest = ctx.positions[i].getNotionalValue(ctx.prices[i]);
            totalAccountOpenInterest += openInterest;
        }
    }

    /**
     * @notice  This function returns the required margins for an account
     * @dev The initial required margin is used to determine withdrawal amount and when opening positions
     * @dev The maintenance margin is used to determine when to liquidate a position
     */
    function getAccountRequiredMargins(
        MemoryContext memory ctx,
        uint256 totalNonDiscountedCollateralValue
    )
        internal
        view
        returns (
            uint256 initialMargin,
            uint256 maintenanceMargin,
            uint256 possibleLiquidationReward
        )
    {
        if (ctx.positions.length == 0) {
            return (0, 0, 0);
        }

        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        for (uint256 i = 0; i < ctx.positions.length; i++) {
            Position.Data memory position = ctx.positions[i];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                position.marketId
            );
            (, , uint256 positionInitialMargin, uint256 positionMaintenanceMargin) = marketConfig
                .calculateRequiredMargins(position.size, ctx.prices[i]);

            maintenanceMargin += positionMaintenanceMargin;
            initialMargin += positionInitialMargin;
        }

        (
            uint256 accumulatedLiquidationRewards,
            uint256 maxNumberOfWindows
        ) = getKeeperRewardsAndCosts(ctx, totalNonDiscountedCollateralValue);
        possibleLiquidationReward = getPossibleLiquidationReward(
            accumulatedLiquidationRewards,
            maxNumberOfWindows,
            totalNonDiscountedCollateralValue,
            getNumberOfUpdatedFeedsRequired(load(ctx.accountId))
        );

        return (initialMargin, maintenanceMargin, possibleLiquidationReward);
    }

    function getNumberOfUpdatedFeedsRequired(
        Data storage self
    ) internal view returns (uint256 numberOfUpdatedFeeds) {
        uint256 numberOfCollateralFeeds = self.activeCollateralTypes.contains(SNX_USD_MARKET_ID)
            ? self.activeCollateralTypes.length() - 1
            : self.activeCollateralTypes.length();
        numberOfUpdatedFeeds = numberOfCollateralFeeds + self.openPositionMarketIds.length();
    }

    function getKeeperRewardsAndCosts(
        MemoryContext memory ctx,
        uint256 totalNonDiscountedCollateralValue
    ) internal view returns (uint256 accumulatedLiquidationRewards, uint256 maxNumberOfWindows) {
        uint256 totalFlagReward = 0;
        // use separate accounting for liquidation rewards so we can compare against global min/max liquidation reward values
        for (uint256 i = 0; i < ctx.positions.length; i++) {
            Position.Data memory position = ctx.positions[i];
            PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
                position.marketId
            );
            uint256 numberOfWindows = marketConfig.numberOfLiquidationWindows(
                MathUtil.abs(position.size)
            );

            uint256 notionalValue = MathUtil.abs(position.size).mulDecimal(ctx.prices[i]);
            uint256 flagReward = marketConfig.calculateFlagReward(notionalValue);
            totalFlagReward += flagReward;

            maxNumberOfWindows = MathUtil.max(numberOfWindows, maxNumberOfWindows);
        }
        GlobalPerpsMarketConfiguration.Data storage globalConfig = GlobalPerpsMarketConfiguration
            .load();
        uint256 collateralReward = globalConfig.calculateCollateralLiquidateReward(
            totalNonDiscountedCollateralValue
        );
        // Take the maximum between flag reward and collateral reward
        accumulatedLiquidationRewards += MathUtil.max(totalFlagReward, collateralReward);
    }

    function getPossibleLiquidationReward(
        uint256 accumulatedLiquidationRewards,
        uint256 numOfWindows,
        uint256 totalNonDiscountedCollateralValue,
        uint256 numberOfUpdatedFeeds
    ) internal view returns (uint256 possibleLiquidationReward) {
        GlobalPerpsMarketConfiguration.Data storage globalConfig = GlobalPerpsMarketConfiguration
            .load();
        KeeperCosts.Data storage keeperCosts = KeeperCosts.load();
        uint256 costOfFlagging = keeperCosts.getFlagKeeperCosts(numberOfUpdatedFeeds);
        uint256 costOfLiquidation = keeperCosts.getLiquidateKeeperCosts();
        uint256 liquidateAndFlagCost = globalConfig.keeperReward(
            accumulatedLiquidationRewards,
            costOfFlagging + costOfLiquidation,
            totalNonDiscountedCollateralValue
        );
        uint256 liquidateWindowsCosts = numOfWindows == 0
            ? 0
            : globalConfig.keeperReward(0, costOfLiquidation, 0) * (numOfWindows - 1);

        possibleLiquidationReward = liquidateAndFlagCost + liquidateWindowsCosts;
    }

    function seizeCollateral(Data storage self) internal returns (uint256 seizedCollateralValue) {
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
        Position.Data memory position,
        uint256 price
    )
        internal
        returns (
            uint128 amountToLiquidate,
            int128 newPositionSize,
            MarketUpdate.Data memory marketUpdateData
        )
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(position.marketId);
        perpsMarket.recomputeFunding(price);

        int128 oldPositionSize = position.size;
        uint128 oldPositionAbsSize = MathUtil.abs128(oldPositionSize);
        amountToLiquidate = perpsMarket.maxLiquidatableAmount(oldPositionAbsSize);

        if (amountToLiquidate == 0) {
            return (0, oldPositionSize, marketUpdateData);
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
                marketId: position.marketId,
                latestInteractionPrice: price.to128(),
                latestInteractionFunding: perpsMarket.lastFundingValue.to128(),
                latestInterestAccrued: 0,
                size: newPositionSize
            });
        }

        // update position markets
        updateOpenPositions(self, position.marketId, newPositionSize);

        // update market data
        marketUpdateData = perpsMarket.updatePositionData(self.id, newPosition);

        return (amountToLiquidate, newPositionSize, marketUpdateData);
    }

    function setOrderMode(
        Data storage self,
        bytes16 mode
    ) internal returns (bytes16 previousOrderMode) {
        previousOrderMode = self.orderMode;
        self.orderMode = mode;

        // solhint-disable-next-line numcast/safe-cast
        self.orderModeChangeTime = uint128(block.timestamp);
    }

    function getOrderMode(Data storage self) internal view returns (bytes16 orderMode) {
        if (block.timestamp - self.orderModeChangeTime < ORDER_MODE_CHANGE_GRACE_PERIOD) {
            return "RECENTLY_CHANGED";
        }

        return self.orderMode;
    }

    function hasOpenPositions(Data storage self) internal view returns (bool) {
        return self.openPositionMarketIds.length() > 0;
    }
}
