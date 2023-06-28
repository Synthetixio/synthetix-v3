//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsAccount} from "./PerpsAccount.sol";

/*
    Note: This library contains all global perps market data
*/
library GlobalPerpsMarket {
    using SafeCastI256 for int256;
    using SetUtil for SetUtil.UintSet;

    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET =
        keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarket"));

    error MaxCollateralExceeded(
        uint128 synthMarketId,
        uint maxAmount,
        uint collateralAmount,
        uint depositAmount
    );
    error SynthNotEnabledForCollateral(uint128 synthMarketId);
    error InsufficientCollateral(uint128 synthMarketId, uint collateralAmount, uint withdrawAmount);

    struct Data {
        SetUtil.UintSet liquidatableAccounts;
        // collateral amounts running total
        mapping(uint128 => uint) collateralAmounts;
    }

    function load() internal pure returns (Data storage marketData) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET;
        assembly {
            marketData.slot := s
        }
    }

    function checkLiquidation(Data storage self, uint128 accountId) internal view {
        if (self.liquidatableAccounts.contains(accountId)) {
            revert PerpsAccount.AccountLiquidatable(accountId);
        }
    }

    /*
        1. checks to ensure max cap isn't hit
        2. adjusts accounting for collateral amounts
    */
    function checkCollateralAmountAndAdjust(
        Data storage self,
        uint128 synthMarketId,
        int synthAmount
    ) internal {
        uint collateralAmount = self.collateralAmounts[synthMarketId];
        if (synthAmount > 0) {
            uint maxAmount = GlobalPerpsMarketConfiguration.load().maxCollateralAmounts[
                synthMarketId
            ];
            if (maxAmount == 0) {
                revert SynthNotEnabledForCollateral(synthMarketId);
            }
            uint newCollateralAmount = collateralAmount + synthAmount.toUint();
            if (newCollateralAmount > maxAmount) {
                revert MaxCollateralExceeded(
                    synthMarketId,
                    maxAmount,
                    collateralAmount,
                    synthAmount.toUint()
                );
            } else {
                self.collateralAmounts[synthMarketId] += synthAmount.toUint();
            }
        } else {
            uint synthAmountAbs = MathUtil.abs(synthAmount);
            if (collateralAmount < synthAmountAbs) {
                revert InsufficientCollateral(synthMarketId, collateralAmount, synthAmountAbs);
            }

            self.collateralAmounts[synthMarketId] -= MathUtil.abs(synthAmount);
        }
    }
}
