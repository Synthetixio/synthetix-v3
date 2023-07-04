//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {PerpsMarket} from "./PerpsMarket.sol";

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
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet activeMarkets;
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

    function rebalanceCollateralToMarkets() internal {
        Data storage self = load();
        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();

        (uint totalMarketValue, uint[] memory marketValues) = _getMarketRatios();
        for (uint i = 1; i < self.activeMarkets.length(); i++) {
            uint ratio = marketValues[i - 1].divDecimal(totalMarketValue);
            uint128 perpsMarketId = self.activeMarkets.at(i).toUint128();

            for (uint j = 1; j < self.activeCollateralTypes.length(); j++) {
                uint128 synthMarketId = self.activeCollateralTypes.at(j).to128();
                uint previousAmount = self.collateralAmounts[synthMarketId];
                uint expectedAmount = self.collateralAmounts[synthMarketId].mulDecimal(ratio);

                // TODO: first do remove collateral before add
                if (previousAmount < expectedAmount) {
                    uint amountToAdd = expectedAmount - previousAmount;
                    perpsMarketFactory.addCollateral(perpsMarketId, synthMarketId, amountToAdd);
                } else {
                    uint amountToRemove = previousAmount - expectedAmount;
                    perpsMarketFactory.removeCollateral(
                        perpsMarketId,
                        synthMarketId,
                        amountToRemove
                    );
                }
            }
        }
    }

    function withdrawCollateralToAccount(PerpsAccount.Data storage account) internal {
        Data storage self = load();
        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();

        (uint totalMarketValue, uint[] memory marketValues) = _getMarketRatios();

        for (uint i = 1; i < account.activeCollateralTypes.length(); i++) {
            for (uint j = 1; j < self.activeMarkets.length(); i++) {
                uint ratio = marketValues[j - 1].divDecimal(totalMarketValue);
                uint amountToWithdraw = account
                    .collateralAmounts[account.activeCollateralTypes.at(i)]
                    .mulDecimal(ratio);

                perpsMarketFactory.removeCollateral(
                    self.activeMarkets.at(j).toUint128(),
                    account.activeCollateralTypes.at(i),
                    amountToWithdraw
                );
            }
            self.collateralAmounts[account.activeCollateralTypes.at(i)] -= account
                .collateralAmounts[account.activeCollateralTypes.at(i)];
        }

        rebalanceCollateralToMarkets();
    }

    function _getMarketRatios(
        Data storage self
    ) private returns (uint totalMarketValue, uint[] memory marketValues) {
        marketValues = new uint256[](self.activeMarkets.length());

        for (uint i = 1; i < self.activeMarkets.length(); i++) {
            uint128 perpsMarketId = self.activeMarkets.at(i).toUint128();
            PerpsMarket.Data storage market = PerpsMarket.load(perpsMarketId);
            marketValues[i - 1] = market.getMarketValue();

            totalMarketValue += marketValues[i - 1];
        }
    }
}
