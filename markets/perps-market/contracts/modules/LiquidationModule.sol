//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ILiquidationModule} from "../interfaces/ILiquidationModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";

contract LiquidationModule is ILiquidationModule, IMarketEvents {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using SetUtil for SetUtil.UintSet;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;

    function liquidate(uint128 accountId) external override {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (!liquidatableAccounts.contains(accountId)) {
            (bool isEligible, , ) = account.isEligibleForLiquidation();

            if (isEligible) {
                account.flagForLiquidation();
                _liquidateAccount(account);
            } else {
                revert NotEligibleForLiquidation(accountId);
            }
        } else {
            _liquidateAccount(account);
        }
    }

    function liquidateFlagged() external override {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        for (uint i = 0; i < liquidatableAccounts.length(); i++) {
            uint128 accountId = liquidatableAccounts.valueAt(i).to128();
            _liquidateAccount(PerpsAccount.load(accountId));
        }
    }

    function _liquidateAccount(PerpsAccount.Data storage account) internal {
        uint128 accountId = account.id;
        uint256[] memory openPositionMarketIds = account.openPositionMarketIds.values();

        uint accumulatedLiquidationRewards;

        for (uint i = 0; i < openPositionMarketIds.length; i++) {
            uint128 positionMarketId = openPositionMarketIds[i].to128();
            uint256 price = PerpsPrice.getCurrentPrice(positionMarketId);

            (
                uint256 amountLiquidated,
                int128 newPositionSize,
                int128 sizeDelta,
                PerpsMarket.MarketUpdateData memory marketUpdateData
            ) = account.liquidatePosition(positionMarketId);

            emit MarketUpdated(
                positionMarketId,
                price,
                marketUpdateData.skew,
                marketUpdateData.size,
                sizeDelta,
                marketUpdateData.currentFundingRate,
                marketUpdateData.currentFundingVelocity
            );

            emit PositionLiquidated(accountId, positionMarketId, amountLiquidated, newPositionSize);

            // using amountToLiquidate to calculate liquidation reward
            uint256 liquidationReward = PerpsMarketConfiguration
                .load(positionMarketId)
                .calculateLiquidationReward(amountLiquidated.mulDecimal(price));
            accumulatedLiquidationRewards += liquidationReward;
        }

        uint256 keeperLiquidationReward = _processLiquidationRewards(accumulatedLiquidationRewards);

        bool accountFullyLiquidated = account.openPositionMarketIds.length() == 0;
        if (accountFullyLiquidated) {
            GlobalPerpsMarket.load().liquidatableAccounts.remove(accountId);
        }

        emit AccountLiquidated(accountId, keeperLiquidationReward, accountFullyLiquidated);
    }

    function _processLiquidationRewards(uint256 totalRewards) private returns (uint256 reward) {
        // pay out liquidation rewards
        reward = GlobalPerpsMarketConfiguration.load().liquidationReward(totalRewards);
        if (reward > 0) {
            PerpsMarketFactory.load().withdrawMarketUsd(msg.sender, reward);
        }
    }
}
