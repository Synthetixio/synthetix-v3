//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
import {SafeCastU256, SafeCastI256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "./PerpsAccount.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {PerpsCollateralConfiguration} from "./PerpsCollateralConfiguration.sol";

/**
 * @title This library contains all global perps market data
 */
library GlobalPerpsMarket {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using DecimalMath for uint256;
    using SetUtil for SetUtil.UintSet;
    using PerpsCollateralConfiguration for PerpsCollateralConfiguration.Data;

    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET =
        keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarket"));

    /**
     * @notice Thrown when attempting to deposit more than enabled collateral.
     */
    error MaxCollateralExceeded(
        uint128 collateralId,
        uint256 maxAmount,
        uint256 collateralAmount,
        uint256 depositAmount
    );

    /**
     * @notice Thrown when attempting to use a synth that is not enabled as collateral.
     */
    error SynthNotEnabledForCollateral(uint128 collateralId);

    /**
     * @notice Thrown when attempting to withdraw more collateral than is available.
     */
    error InsufficientCollateral(
        uint128 collateralId,
        uint256 collateralAmount,
        uint256 withdrawAmount
    );

    /**
     * @notice Thrown when an order puts the market above its credit capacity by checking it's utilization
     */
    error ExceedsMarketCreditCapacity(int256 delegatedCollateral, int256 newLockedCredit);

    struct Data {
        /**
         * @dev Set of liquidatable account ids.
         */
        SetUtil.UintSet liquidatableAccounts;
        /**
         * @dev Collateral amounts running total, by collateral synth market id.
         */
        mapping(uint128 => uint256) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet activeMarkets;
        /**
         * @dev Total debt that hasn't been paid across all accounts.
         */
        uint256 totalAccountsDebt;
    }

    function load() internal pure returns (Data storage marketData) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET;
        assembly {
            marketData.slot := s
        }
    }

    /**
     * @notice assert the locked credit delta does not exceed market capacity
     * @dev reverts if applying the delta exceeds the markets credit capacity
     * @param self reference to the global perps market data
     * @param lockedCreditDelta the proposed change in credit to be validated
     */
    function validateMarketCapacity(Data storage self, int256 lockedCreditDelta) internal view {
        (
            bool isMarketSolvent,
            int256 delegatedCollateralValue,
            int256 credit
        ) = isMarketSolventForCreditDelta(self, lockedCreditDelta);

        // revert if accumulated credit value exceeds what is currently collateralizing the perp markets
        if (!isMarketSolvent) revert ExceedsMarketCreditCapacity(delegatedCollateralValue, credit);
    }

    function isMarketSolventForCreditDelta(
        Data storage self,
        int256 lockedCreditDelta
    ) internal view returns (bool isMarketSolvent, int256 delegatedCollateralValue, int256 credit) {
        // establish amount of collateral currently collateralizing outstanding perp markets
        delegatedCollateralValue = getDelegatedCollateralValue(self);

        // establish amount of credit needed to collateralize outstanding perp markets
        credit = minimumCredit(self, PerpsPrice.Tolerance.ONE_MONTH).toInt();

        // calculate new accumulated credit following the addition of the new locked credit
        credit += lockedCreditDelta;

        // Market insolvent delegatedCollateralValue < credit
        isMarketSolvent = delegatedCollateralValue >= credit;
    }

    function utilizationRate(
        Data storage self,
        PerpsPrice.Tolerance minCreditPriceTolerance
    ) internal view returns (uint128 rate, uint256 delegatedCollateralValue, uint256 lockedCredit) {
        int256 delegatedCollateralValueInt = getDelegatedCollateralValue(self);
        lockedCredit = minimumCredit(self, minCreditPriceTolerance);
        if (delegatedCollateralValueInt <= 0) {
            return (DecimalMath.UNIT_UINT128, 0, lockedCredit);
        }

        delegatedCollateralValue = delegatedCollateralValueInt.toUint();

        rate = lockedCredit.divDecimal(delegatedCollateralValue).to128();

        // Cap at 100% utilization
        if (rate > DecimalMath.UNIT_UINT128) {
            rate = DecimalMath.UNIT_UINT128;
        }
    }

    /// @notice get the value of collateral that is currently delegated to the perps market
    /// @dev value does not include trader provided collateral (i.e., margin)
    /// @dev value returned is denominated in USD
    /// @dev negative values indicate credit capacity exceeded, and lp's are at risk of liquidation
    /// @return value of delegated collateral; negative values indicate credit capacity exceeded
    function getDelegatedCollateralValue(Data storage self) internal view returns (int256 value) {
        // following call returns zero if market liabilities exceed assets
        // (i.e., total market collateral is insufficient to collateralize outstanding debt)
        uint256 withdrawableUsd = PerpsMarketFactory.totalWithdrawableUsd();

        /// @custom:insolvent when negative, the market has overdrawn its credit
        /// and therefore cannot unwind all existing positions
        value = withdrawableUsd.toInt() - totalCollateralValue(self).toInt();
    }

    function minimumCredit(
        Data storage self,
        PerpsPrice.Tolerance priceTolerance
    ) internal view returns (uint256 accumulatedMinimumCredit) {
        uint256[] memory activeMarkets = self.activeMarkets.values();
        uint256[] memory requiredCredits = PerpsMarket.requiredCredits(
            activeMarkets,
            priceTolerance
        );
        for (uint256 i = 0; i < activeMarkets.length; i++) {
            accumulatedMinimumCredit += requiredCredits[i];
        }
    }

    function totalCollateralValue(Data storage self) internal view returns (uint256 total) {
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        SetUtil.UintSet storage activeCollateralTypes = self.activeCollateralTypes;
        uint256 activeCollateralLength = activeCollateralTypes.length();
        for (uint256 i = 1; i <= activeCollateralLength; i++) {
            uint128 collateralId = activeCollateralTypes.valueAt(i).to128();

            if (collateralId == SNX_USD_MARKET_ID) {
                total += self.collateralAmounts[collateralId];
            } else {
                (uint256 collateralValue, ) = PerpsCollateralConfiguration
                    .load(collateralId)
                    .valueInUsd(
                        self.collateralAmounts[collateralId],
                        spotMarket,
                        PerpsPrice.Tolerance.DEFAULT,
                        false
                    );
                total += collateralValue;
            }
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
            self.activeCollateralTypes.add(collateralId.to256());
        } else if (collateralAmount == 0 && isActiveCollateral) {
            self.activeCollateralTypes.remove(collateralId.to256());
        }
    }

    function updateDebt(Data storage self, int256 debtDelta) internal {
        int256 newTotalAccountsDebt = self.totalAccountsDebt.toInt() + debtDelta;
        self.totalAccountsDebt = newTotalAccountsDebt < 0 ? 0 : newTotalAccountsDebt.toUint();
    }

    /**
     * @notice Check if the account is set as liquidatable.
     */
    function checkLiquidation(Data storage self, uint128 accountId) internal view {
        if (self.liquidatableAccounts.contains(accountId)) {
            revert PerpsAccount.AccountLiquidatable(accountId);
        }
    }

    /**
     * @notice Check the collateral is enabled and amount acceptable and adjusts accounting.
     * @dev called when the account is modifying collateral.
     * @dev 1. checks to ensure max cap isn't hit
     * @dev 2. adjusts accounting for collateral amounts
     */
    function validateCollateralAmount(
        Data storage self,
        uint128 collateralId,
        int256 synthAmount
    ) internal view {
        uint256 collateralAmount = self.collateralAmounts[collateralId];
        if (synthAmount > 0) {
            uint256 maxAmount = PerpsCollateralConfiguration.load(collateralId).maxAmount;
            if (maxAmount == 0) {
                revert SynthNotEnabledForCollateral(collateralId);
            }
            uint256 newCollateralAmount = collateralAmount + synthAmount.toUint();
            if (newCollateralAmount > maxAmount) {
                revert MaxCollateralExceeded(
                    collateralId,
                    maxAmount,
                    collateralAmount,
                    synthAmount.toUint()
                );
            }
        } else {
            uint256 synthAmountAbs = MathUtil.abs(synthAmount);
            if (collateralAmount < synthAmountAbs) {
                revert InsufficientCollateral(collateralId, collateralAmount, synthAmountAbs);
            }
        }
    }

    function addMarket(Data storage self, uint128 marketId) internal {
        self.activeMarkets.add(marketId.to256());
    }
}
