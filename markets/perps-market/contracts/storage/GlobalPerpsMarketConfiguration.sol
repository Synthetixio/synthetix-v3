//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {IFeeCollector} from "../interfaces/external/IFeeCollector.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {CollateralConfiguration} from "./CollateralConfiguration.sol";

/**
 * @title This library contains all global perps market configuration data
 */
library GlobalPerpsMarketConfiguration {
    using DecimalMath for uint256;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using SetUtil for SetUtil.UintSet;
    using SafeCastU128 for uint128;

    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION =
        keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarketConfiguration"));

    struct Data {
        /**
         * @dev fee collector contract
         * @dev portion or all of the order fees are sent to fee collector contract based on quote.
         */
        IFeeCollector feeCollector;
        /**
         * @dev Percentage share of fees for each referrer address
         */
        mapping(address => uint256) referrerShare;
        /**
         * @dev previously maxCollateralAmounts[collateralId] was used in storage slot
         */
        mapping(uint128 => uint256) __unused_1;
        /**
         * @dev when deducting from user's margin which is made up of many synths, this priority governs which synth to sell for deduction
         */
        uint128[] synthDeductionPriority;
        /**
         * @dev minimum configured keeper reward for the sender who liquidates the account
         */
        uint256 minKeeperRewardUsd;
        /**
         * @dev maximum configured keeper reward for the sender who liquidates the account
         */
        uint256 maxKeeperRewardUsd;
        /**
         * @dev maximum configured number of concurrent positions per account.
         * @notice If set to zero it means no new positions can be opened, but existing positions can be increased or decreased.
         * @notice If set to a larger number (larger than number of markets created) it means is unlimited.
         */
        uint128 maxPositionsPerAccount;
        /**
         * @dev maximum configured number of concurrent collaterals per account.
         * @notice If set to zero it means no new collaterals can be added accounts, but existing collaterals can be increased or decreased.
         * @notice If set to a larger number (larger than number of collaterals enabled) it means is unlimited.
         */
        uint128 maxCollateralsPerAccount;
        /**
         * @dev used together with minKeeperRewardUsd to get the minumum keeper reward for the sender who settles, or liquidates the account
         */
        uint256 minKeeperProfitRatioD18;
        /**
         * @dev used together with maxKeeperRewardUsd to get the maximum keeper reward for the sender who settles, or liquidates the account
         */
        uint256 maxKeeperScalingRatioD18;
        /**
         * @dev set of supported collateral types. By supported we mean collateral types that have a maxCollateralAmount > 0
         */
        SetUtil.UintSet supportedCollateralTypes;
        /**
         * @dev interest rate gradient applied to utilization prior to hitting the gradient breakpoint
         */
        uint128 lowUtilizationInterestRateGradient;
        /**
         * @dev breakpoint at which the interest rate gradient changes from low to high
         */
        uint128 interestRateGradientBreakpoint;
        /**
         * @dev interest rate gradient applied to utilization after hitting the gradient breakpoint
         */
        uint128 highUtilizationInterestRateGradient;
        /**
         * @dev ratio of the collateral liquidation reward. 1e18 is 100%.
         */
        uint128 collateralLiquidateRewardRatioD18;
        /**
         * @dev reward distributor implementation. This is used as a base to be cloned to distribute rewards to the liquidator.
         */
        address rewardDistributorImplementation;
    }

    function load() internal pure returns (Data storage globalMarketConfig) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION;
        assembly {
            globalMarketConfig.slot := s
        }
    }

    function loadInterestRateParameters() internal view returns (uint128, uint128, uint128) {
        Data storage self = load();
        return (
            self.lowUtilizationInterestRateGradient,
            self.interestRateGradientBreakpoint,
            self.highUtilizationInterestRateGradient
        );
    }

    function minimumKeeperRewardCap(
        Data storage self,
        uint256 costOfExecutionInUsd
    ) internal view returns (uint256) {
        return
            MathUtil.max(
                costOfExecutionInUsd + self.minKeeperRewardUsd,
                costOfExecutionInUsd.mulDecimal(self.minKeeperProfitRatioD18 + DecimalMath.UNIT)
            );
    }

    function maximumKeeperRewardCap(
        Data storage self,
        uint256 availableMarginInUsd
    ) internal view returns (uint256) {
        // Note: if availableMarginInUsd is zero, it means the account was flagged, so the maximumKeeperRewardCap will just be maxKeeperRewardUsd
        if (availableMarginInUsd == 0) {
            return self.maxKeeperRewardUsd;
        }

        return
            MathUtil.min(
                availableMarginInUsd.mulDecimal(self.maxKeeperScalingRatioD18),
                self.maxKeeperRewardUsd
            );
    }

    /**
     * @dev returns the keeper reward based on total keeper rewards from all markets compared against min/max
     */
    function keeperReward(
        Data storage self,
        uint256 keeperRewards,
        uint256 costOfExecutionInUsd,
        uint256 availableMarginInUsd
    ) internal view returns (uint256) {
        uint256 minCap = minimumKeeperRewardCap(self, costOfExecutionInUsd);
        uint256 maxCap = maximumKeeperRewardCap(self, availableMarginInUsd);
        return MathUtil.min(MathUtil.max(minCap, keeperRewards + costOfExecutionInUsd), maxCap);
    }

    function updateSynthDeductionPriority(
        Data storage self,
        uint128[] memory newSynthDeductionPriority
    ) internal {
        delete self.synthDeductionPriority;

        for (uint256 i = 0; i < newSynthDeductionPriority.length; i++) {
            self.synthDeductionPriority.push(newSynthDeductionPriority[i]);
        }
    }

    function collectFees(
        Data storage self,
        uint256 orderFees,
        address referrer,
        PerpsMarketFactory.Data storage factory
    ) internal returns (uint256 referralFees, uint256 feeCollectorFees) {
        referralFees = _collectReferrerFees(self, orderFees, referrer, factory);
        uint256 remainingFees = orderFees - referralFees;

        if (remainingFees == 0 || self.feeCollector == IFeeCollector(address(0))) {
            return (referralFees, 0);
        }

        uint256 feeCollectorQuote = self.feeCollector.quoteFees(
            factory.perpsMarketId,
            remainingFees,
            ERC2771Context._msgSender()
        );

        if (feeCollectorQuote == 0) {
            return (referralFees, 0);
        }

        if (feeCollectorQuote > remainingFees) {
            feeCollectorQuote = remainingFees;
        }

        factory.withdrawMarketUsd(address(self.feeCollector), feeCollectorQuote);

        return (referralFees, feeCollectorQuote);
    }

    function calculateCollateralLiquidateReward(
        Data storage self,
        uint256 notionalValue
    ) internal view returns (uint256) {
        return notionalValue.mulDecimal(self.collateralLiquidateRewardRatioD18);
    }

    function updateCollateralMax(
        Data storage self,
        uint128 collateralId,
        uint256 maxCollateralAmount
    ) internal {
        CollateralConfiguration.load(collateralId).setMax(collateralId, maxCollateralAmount);

        bool isSupportedCollateral = self.supportedCollateralTypes.contains(collateralId);
        if (maxCollateralAmount > 0 && !isSupportedCollateral) {
            self.supportedCollateralTypes.add(collateralId.to256());
        } else if (maxCollateralAmount == 0 && isSupportedCollateral) {
            self.supportedCollateralTypes.remove(collateralId.to256());
        }
    }

    function _collectReferrerFees(
        Data storage self,
        uint256 fees,
        address referrer,
        PerpsMarketFactory.Data storage factory
    ) private returns (uint256 referralFeesSent) {
        if (referrer == address(0)) {
            return 0;
        }

        uint256 referrerShareRatio = self.referrerShare[referrer];
        if (referrerShareRatio > 0) {
            referralFeesSent = fees.mulDecimal(referrerShareRatio);
            factory.withdrawMarketUsd(referrer, referralFeesSent);
        }
    }
}
