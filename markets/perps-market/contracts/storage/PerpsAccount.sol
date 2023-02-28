//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "../interfaces/external/ISpotMarketSystem.sol";
import "./Position.sol";
import "./PerpsMarket.sol";
import "../utils/MathUtil.sol";
import "./PerpsPrice.sol";

/**
 * @title Data for a single perps market
 */
library PerpsAccount {
    using SetUtil for SetUtil.UintSet;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using Position for Position.Data;
    using PerpsPrice for PerpsPrice.Data;
    using DecimalMath for int256;
    using DecimalMath for uint256;

    struct Data {
        // synth marketId => amount
        mapping(uint128 => uint) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet openPositionMarketIds;
    }

    error InsufficientCollateralAvailableForWithdraw(uint available, uint required);

    error InsufficientMarginError(uint leftover);

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));

        assembly {
            account.slot := s
        }
    }

    function updatePositionMarkets(Data storage self, uint positionMarketId, int size) internal {
        if (size == 0) {
            self.openPositionMarketIds.remove(positionMarketId);
        } else if (!self.openPositionMarketIds.contains(positionMarketId)) {
            self.openPositionMarketIds.add(positionMarketId);
        }
    }

    // Checks current collateral amounts
    function checkAvailableCollateralAmount(
        Data storage self,
        uint128 collateralType,
        uint amount
    ) internal view {
        uint availableAmount = self.collateralAmounts[collateralType];
        if (availableAmount < amount) {
            revert InsufficientCollateralAvailableForWithdraw(availableAmount, amount);
        }
    }

    // Checks available withdrawable value across all positions
    function checkAvailableWithdrawalValue(
        Data storage self,
        uint128 accountId,
        int amount
    ) internal returns (uint) {
        uint availableWithdrawableCollateralUsd = getAvailableWithdrawableCollateralUsd(
            self,
            accountId
        );
        if (availableWithdrawableCollateralUsd < MathUtil.abs(amount)) {
            revert InsufficientCollateralAvailableForWithdraw(
                availableWithdrawableCollateralUsd,
                MathUtil.abs(amount)
            );
        }
        return availableWithdrawableCollateralUsd;
    }

    function getAvailableWithdrawableCollateralUsd(
        Data storage self,
        uint128 accountId
    ) internal returns (uint) {
        int totalAccountOpenInterest;
        for (uint i = 0; i < self.openPositionMarketIds.length(); i++) {
            uint128 marketId = self.openPositionMarketIds.valueAt(i).to128();

            Position.Data memory position = PerpsMarket.load(marketId).positions[accountId];
            (int marginProfitFunding, , , , ) = position.calculateExpectedPosition(
                PerpsPrice.getCurrentPrice(marketId)
            );
            totalAccountOpenInterest += marginProfitFunding;
        }
        uint totalCollateralValue;

        ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
        for (uint i = 0; i < self.activeCollateralTypes.length(); i++) {
            uint128 synthMarketId = self.activeCollateralTypes.valueAt(i).to128();

            uint amount = self.collateralAmounts[synthMarketId];

            uint amountToAdd;
            if (synthMarketId == 0) {
                amountToAdd = amount;
            } else {
                (amountToAdd, ) = spotMarket.quoteSell(synthMarketId, amount);
            }
            totalCollateralValue += amountToAdd;
        }
        uint maxLeverage = PerpsMarketFactory.load().maxLeverage;
        uint accountMaxOpenInterest = totalCollateralValue.mulDecimal(maxLeverage);

        return (accountMaxOpenInterest.toInt() - totalAccountOpenInterest).toUint();
    }

    function deductFromAccount(
        Data storage self,
        uint amount // snxUSD
    ) internal {
        uint leftoverAmount = amount;
        uint128[] storage deductionMarketOrder = PerpsMarketFactory.load().deductionMarketOrder;
        for (uint i = 0; i < deductionMarketOrder.length; i++) {
            uint128 marketId = deductionMarketOrder[i];
            uint availableAmount = self.collateralAmounts[marketId];
            if (availableAmount == 0) {
                continue;
            }

            if (marketId == 0) {
                // snxUSD
                if (availableAmount >= leftoverAmount) {
                    self.collateralAmounts[marketId] = availableAmount - leftoverAmount;
                    break;
                } else {
                    self.collateralAmounts[marketId] = 0;
                    leftoverAmount -= availableAmount;
                }
            } else {
                // TODO: check if market is paused; if not, continue
                ISpotMarketSystem spotMarket = PerpsMarketFactory.load().spotMarket;
                // TODO: sell $2 worth of synth
                (uint availableAmountUsd, ) = spotMarket.quoteSell(marketId, availableAmount);
                if (availableAmountUsd >= leftoverAmount) {
                    uint amountToDeduct = spotMarket.sellExactOut(marketId, leftoverAmount);
                    self.collateralAmounts[marketId] = availableAmount - amountToDeduct;
                    break;
                } else {
                    uint amountToDeduct = spotMarket.sellExactIn(marketId, availableAmount);
                    self.collateralAmounts[marketId] = 0;
                    leftoverAmount -= amountToDeduct;
                }
            }
        }

        if (leftoverAmount > 0) {
            revert InsufficientMarginError(leftoverAmount);
        }
    }
}
