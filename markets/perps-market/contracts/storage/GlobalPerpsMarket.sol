//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";
import {SafeCastU256, SafeCastI256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";

/**
 * @title This library contains all global perps market data
 */
library GlobalPerpsMarket {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using SetUtil for SetUtil.UintSet;

    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET =
        keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarket"));

    /**
     * @notice Thrown when attempting to deposit more than enabled collateral.
     */
    error MaxCollateralExceeded(
        uint128 synthMarketId,
        uint maxAmount,
        uint collateralAmount,
        uint depositAmount
    );

    /**
     * @notice Thrown when attempting to use a synth that is not enabled as collateral.
     */
    error SynthNotEnabledForCollateral(uint128 synthMarketId);

    /**
     * @notice Thrown when attempting to withdraw more collateral than is available.
     */
    error InsufficientCollateral(uint128 synthMarketId, uint collateralAmount, uint withdrawAmount);

    struct Data {
        /**
         * @dev Set of liquidatable account ids.
         */
        SetUtil.UintSet liquidatableAccounts;
        /**
         * @dev Collateral amounts running total, by collateral synth market id.
         */
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

    function totalCollateralValue(Data storage self) internal view returns (uint256 total) {
        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        SetUtil.UintSet storage activeCollateralTypes = self.activeCollateralTypes;
        uint256 activeCollateralLength = activeCollateralTypes.length();
        for (uint i = 1; i <= activeCollateralLength; i++) {
            uint128 synthMarketId = activeCollateralTypes.valueAt(i).to128();

            if (synthMarketId == 0) {
                total += self.collateralAmounts[synthMarketId];
            } else {
                (uint collateralValue, ) = spotMarket.quoteSellExactIn(
                    synthMarketId,
                    self.collateralAmounts[synthMarketId]
                );
                total += collateralValue;
            }
        }
    }

    function updateCollateralAmount(
        Data storage self,
        uint128 synthMarketId,
        int amountDelta
    ) internal returns (uint collateralAmount) {
        collateralAmount = (self.collateralAmounts[synthMarketId].toInt() + amountDelta).toUint();
        self.collateralAmounts[synthMarketId] = collateralAmount;

        bool isActiveCollateral = self.activeCollateralTypes.contains(synthMarketId);
        if (collateralAmount > 0 && !isActiveCollateral) {
            self.activeCollateralTypes.add(synthMarketId.to256());
        } else if (collateralAmount == 0 && isActiveCollateral) {
            self.activeCollateralTypes.remove(synthMarketId.to256());
        }
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
        uint128 synthMarketId,
        int synthAmount
    ) internal view {
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
            }
        } else {
            uint synthAmountAbs = MathUtil.abs(synthAmount);
            if (collateralAmount < synthAmountAbs) {
                revert InsufficientCollateral(synthMarketId, collateralAmount, synthAmountAbs);
            }
        }
    }

    function addMarket(Data storage self, uint128 marketId) internal {
        self.activeMarkets.add(marketId.to256());
    }
}
