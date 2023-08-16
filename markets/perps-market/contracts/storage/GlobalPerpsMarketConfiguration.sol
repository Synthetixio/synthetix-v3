//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {IFeeCollector} from "../interfaces/external/IFeeCollector.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";

/**
 * @title This library contains all global perps market configuration data
 */
library GlobalPerpsMarketConfiguration {
    using DecimalMath for uint256;
    using PerpsMarketFactory for PerpsMarketFactory.Data;

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
         * @dev mapping of configured synthMarketId to max collateral amount.
         * @dev USD token synth market id = 0
         */
        mapping(uint128 => uint) maxCollateralAmounts;
        /**
         * @dev when deducting from user's margin which is made up of many synths, this priority governs which synth to sell for deduction
         */
        uint128[] synthDeductionPriority;
        /**
         * @dev minimum configured liquidation reward for the sender who liquidates the account
         */
        uint minLiquidationRewardUsd;
        /**
         * @dev maximum configured liquidation reward for the sender who liquidates the account
         */
        uint maxLiquidationRewardUsd;
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
    }

    function load() internal pure returns (Data storage globalMarketConfig) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION;
        assembly {
            globalMarketConfig.slot := s
        }
    }

    /**
     * @dev returns the liquidation reward based on total liquidation rewards from all markets compared against min/max
     */
    function liquidationReward(
        Data storage self,
        uint256 totalLiquidationRewards
    ) internal view returns (uint256) {
        return
            MathUtil.min(
                MathUtil.max(totalLiquidationRewards, self.minLiquidationRewardUsd),
                self.maxLiquidationRewardUsd
            );
    }

    function updateSynthDeductionPriority(
        Data storage self,
        uint128[] memory newSynthDeductionPriority
    ) internal {
        delete self.synthDeductionPriority;

        for (uint i = 0; i < newSynthDeductionPriority.length; i++) {
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
            msg.sender
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
