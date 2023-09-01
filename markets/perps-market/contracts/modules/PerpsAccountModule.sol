//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IPerpsAccountModule} from "../interfaces/IPerpsAccountModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {Position} from "../storage/Position.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Module to manage accounts
 * @dev See IPerpsAccountModule.
 */
contract PerpsAccountModule is IPerpsAccountModule {
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function modifyCollateral(
        uint128 accountId,
        uint128 synthMarketId,
        int amountDelta
    ) external override {
        Account.exists(accountId);
        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        if (amountDelta == 0) revert InvalidAmountDelta(amountDelta);

        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();

        GlobalPerpsMarket.Data storage globalPerpsMarket = GlobalPerpsMarket.load();
        globalPerpsMarket.validateCollateralAmount(synthMarketId, amountDelta);
        globalPerpsMarket.checkLiquidation(accountId);

        PerpsAccount.Data storage account = PerpsAccount.create(accountId);
        uint128 perpsMarketId = perpsMarketFactory.perpsMarketId;

        PerpsAccount.validateMaxCollaterals(accountId, synthMarketId);

        AsyncOrder.checkPendingOrder(account.id);

        if (amountDelta > 0) {
            _depositMargin(perpsMarketFactory, perpsMarketId, synthMarketId, amountDelta.toUint());
        } else {
            uint256 amountAbs = MathUtil.abs(amountDelta);
            // removing collateral
            account.validateWithdrawableAmount(amountAbs);
            _withdrawMargin(perpsMarketFactory, perpsMarketId, synthMarketId, amountAbs);
        }

        // accounting
        account.updateCollateralAmount(synthMarketId, amountDelta);

        emit CollateralModified(accountId, synthMarketId, amountDelta, msg.sender);
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalCollateralValue();
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function totalAccountOpenInterest(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalNotionalOpenInterest();
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getOpenPosition(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (int256 totalPnl, int256 accruedFunding, int128 positionSize) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.loadValid(marketId);

        Position.Data storage position = perpsMarket.positions[accountId];

        (, totalPnl, , accruedFunding, , ) = position.getPositionData(
            PerpsPrice.getCurrentPrice(marketId)
        );
        return (totalPnl, accruedFunding, position.size);
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getAvailableMargin(
        uint128 accountId
    ) external view override returns (int256 availableMargin) {
        availableMargin = PerpsAccount.load(accountId).getAvailableMargin();
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getWithdrawableMargin(
        uint128 accountId
    ) external view override returns (int256 withdrawableMargin) {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        int256 availableMargin = account.getAvailableMargin();
        (uint256 initialRequiredMargin, , , uint256 liquidationReward) = account
            .getAccountRequiredMargins();

        uint256 requiredMargin = initialRequiredMargin + liquidationReward;

        withdrawableMargin = availableMargin - requiredMargin.toInt();
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getRequiredMargins(
        uint128 accountId
    )
        external
        view
        override
        returns (
            uint256 requiredInitialMargin,
            uint256 requiredMaintenanceMargin,
            uint256 totalAccumulatedLiquidationRewards,
            uint256 maxLiquidationReward
        )
    {
        (
            requiredInitialMargin,
            requiredMaintenanceMargin,
            totalAccumulatedLiquidationRewards,
            maxLiquidationReward
        ) = PerpsAccount.load(accountId).getAccountRequiredMargins();

        // Include liquidation rewards to required initial margin and required maintenance margin
        requiredInitialMargin += maxLiquidationReward;
        requiredMaintenanceMargin += maxLiquidationReward;
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getCollateralAmount(
        uint128 accountId,
        uint128 synthMarketId
    ) external view override returns (uint256) {
        return PerpsAccount.load(accountId).collateralAmounts[synthMarketId];
    }

    function _depositMargin(
        PerpsMarketFactory.Data storage perpsMarketFactory,
        uint128 perpsMarketId,
        uint128 synthMarketId,
        uint256 amount
    ) internal {
        if (synthMarketId == 0) {
            // depositing into the USD market
            perpsMarketFactory.synthetix.depositMarketUsd(perpsMarketId, msg.sender, amount);
        } else {
            ITokenModule synth = ITokenModule(
                perpsMarketFactory.spotMarket.getSynth(synthMarketId)
            );
            synth.transferFrom(msg.sender, address(this), amount);
            // depositing into a synth market
            perpsMarketFactory.depositMarketCollateral(synth, amount);
        }
    }

    function _withdrawMargin(
        PerpsMarketFactory.Data storage perpsMarketFactory,
        uint128 perpsMarketId,
        uint128 synthMarketId,
        uint256 amount
    ) internal {
        if (synthMarketId == 0) {
            // withdrawing from the USD market
            perpsMarketFactory.synthetix.withdrawMarketUsd(perpsMarketId, msg.sender, amount);
        } else {
            ITokenModule synth = ITokenModule(
                perpsMarketFactory.spotMarket.getSynth(synthMarketId)
            );
            // withdrawing from a synth market
            perpsMarketFactory.synthetix.withdrawMarketCollateral(
                perpsMarketId,
                address(synth),
                amount
            );
            synth.transfer(msg.sender, amount);
        }
    }
}
