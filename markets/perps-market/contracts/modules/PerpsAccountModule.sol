//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IPerpsAccountModule} from "../interfaces/IPerpsAccountModule.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {Position} from "../storage/Position.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {InterestRate} from "../storage/InterestRate.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsCollateralConfiguration} from "../storage/PerpsCollateralConfiguration.sol";

/**
 * @title Module to manage accounts
 * @dev See IPerpsAccountModule.
 */
contract PerpsAccountModule is IPerpsAccountModule {
    using SetUtil for SetUtil.UintSet;
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function modifyCollateral(
        uint128 accountId,
        uint128 collateralId,
        int256 amountDelta
    ) external override {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        bool distributorExists = PerpsCollateralConfiguration.validDistributorExists(collateralId);
        if (!distributorExists) {
            revert InvalidDistributor(collateralId);
        }

        Account.exists(accountId);
        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        if (amountDelta == 0) revert InvalidAmountDelta(amountDelta);

        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();

        GlobalPerpsMarket.Data storage globalPerpsMarket = GlobalPerpsMarket.load();
        globalPerpsMarket.validateCollateralAmount(collateralId, amountDelta);
        globalPerpsMarket.checkLiquidation(accountId);

        PerpsAccount.Data storage account = PerpsAccount.create(accountId);
        uint128 perpsMarketId = perpsMarketFactory.perpsMarketId;

        PerpsAccount.validateMaxCollaterals(accountId, collateralId);

        AsyncOrder.checkPendingOrder(account.id);

        if (amountDelta > 0) {
            _depositMargin(perpsMarketFactory, perpsMarketId, collateralId, amountDelta.toUint());
        } else {
            uint256 amountAbs = MathUtil.abs(amountDelta);
            // removing collateral
            account.validateWithdrawableAmount(
                collateralId,
                amountAbs,
                perpsMarketFactory.spotMarket
            );
            _withdrawMargin(perpsMarketFactory, perpsMarketId, collateralId, amountAbs);
        }

        // accounting
        account.updateCollateralAmount(collateralId, amountDelta);

        emit CollateralModified(accountId, collateralId, amountDelta, ERC2771Context._msgSender());
    }

    function debt(uint128 accountId) external view override returns (uint256 accountDebt) {
        Account.exists(accountId);
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);

        accountDebt = account.debt;
    }

    // 1. call depositMarketUsd and deposit amount directly to core system
    // 2. look up account and reduce debt by amount
    function payDebt(uint128 accountId, uint256 amount) external override {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        Account.exists(accountId);

        AsyncOrder.checkPendingOrder(accountId);

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        uint256 debtPaid = account.payDebt(amount);

        emit DebtPaid(accountId, debtPaid, ERC2771Context._msgSender());

        // update interest rate after debt paid since credit capacity for market has increased
        (uint128 interestRate, ) = InterestRate.update(PerpsPrice.Tolerance.DEFAULT);
        emit IGlobalPerpsMarketModule.InterestRateUpdated(
            PerpsMarketFactory.load().perpsMarketId,
            interestRate
        );
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function totalCollateralValue(
        uint128 accountId
    ) external view override returns (uint256 totalValue) {
        (totalValue, ) = PerpsAccount.load(accountId).getTotalCollateralValue(
            PerpsPrice.Tolerance.DEFAULT
        );
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function totalAccountOpenInterest(uint128 accountId) external view override returns (uint256) {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        (Position.Data[] memory positions, uint256[] memory prices) = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.DEFAULT);
        return PerpsAccount.getTotalNotionalOpenInterest(positions, prices);
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getOpenPosition(
        uint128 accountId,
        uint128 marketId
    )
        external
        view
        override
        returns (int256 totalPnl, int256 accruedFunding, int128 positionSize, uint256 owedInterest)
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.loadValid(marketId);

        Position.Data storage position = perpsMarket.positions[accountId];

        (, totalPnl, , owedInterest, accruedFunding, , ) = position.getPositionData(
            PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
        );
        return (totalPnl, accruedFunding, position.size, owedInterest);
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getOpenPositionSize(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (int128 positionSize) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.loadValid(marketId);

        positionSize = perpsMarket.positions[accountId].size;
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getAvailableMargin(
        uint128 accountId
    ) external view override returns (int256 availableMargin) {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        (Position.Data[] memory positions, uint256[] memory prices) = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.DEFAULT);
        (uint256 totalCollateralValueWithDiscount, ) = account.getTotalCollateralValue(
            PerpsPrice.Tolerance.DEFAULT
        );
        availableMargin = PerpsAccount.load(accountId).getAvailableMargin(
            positions,
            prices,
            totalCollateralValueWithDiscount
        );
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getWithdrawableMargin(
        uint128 accountId
    ) external view override returns (int256 withdrawableMargin) {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        (Position.Data[] memory positions, uint256[] memory prices) = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.DEFAULT);
        (
            uint256 totalCollateralValueWithDiscount,
            uint256 totalCollateralValueWithoutDiscount
        ) = account.getTotalCollateralValue(PerpsPrice.Tolerance.DEFAULT);
        withdrawableMargin = account.getWithdrawableMargin(
            positions,
            prices,
            totalCollateralValueWithDiscount,
            totalCollateralValueWithoutDiscount
        );
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
            uint256 maxLiquidationReward
        )
    {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (account.openPositionMarketIds.length() == 0) {
            return (0, 0, 0);
        }

        (Position.Data[] memory positions, uint256[] memory prices) = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.DEFAULT);
        (, uint256 totalCollateralValueWithoutDiscount) = account.getTotalCollateralValue(
            PerpsPrice.Tolerance.DEFAULT
        );
        (requiredInitialMargin, requiredMaintenanceMargin, maxLiquidationReward) = account
            .getAccountRequiredMargins(positions, prices, totalCollateralValueWithoutDiscount);

        // Include liquidation rewards to required initial margin and required maintenance margin
        requiredInitialMargin += maxLiquidationReward;
        requiredMaintenanceMargin += maxLiquidationReward;
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getCollateralAmount(
        uint128 accountId,
        uint128 collateralId
    ) external view override returns (uint256) {
        return PerpsAccount.load(accountId).collateralAmounts[collateralId];
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getAccountCollateralIds(
        uint128 accountId
    ) external view override returns (uint256[] memory) {
        return PerpsAccount.load(accountId).activeCollateralTypes.values();
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getAccountOpenPositions(
        uint128 accountId
    ) external view override returns (uint256[] memory) {
        return PerpsAccount.load(accountId).openPositionMarketIds.values();
    }

    function _depositMargin(
        PerpsMarketFactory.Data storage perpsMarketFactory,
        uint128 perpsMarketId,
        uint128 collateralId,
        uint256 amount
    ) internal {
        if (collateralId == SNX_USD_MARKET_ID) {
            // depositing into the USD market
            perpsMarketFactory.synthetix.depositMarketUsd(
                perpsMarketId,
                ERC2771Context._msgSender(),
                amount
            );
        } else {
            ITokenModule synth = ITokenModule(perpsMarketFactory.spotMarket.getSynth(collateralId));
            synth.transferFrom(ERC2771Context._msgSender(), address(this), amount);
            // depositing into a synth market
            perpsMarketFactory.depositMarketCollateral(synth, amount);
        }
    }

    function _withdrawMargin(
        PerpsMarketFactory.Data storage perpsMarketFactory,
        uint128 perpsMarketId,
        uint128 collateralId,
        uint256 amount
    ) internal {
        if (collateralId == SNX_USD_MARKET_ID) {
            // withdrawing from the USD market
            perpsMarketFactory.synthetix.withdrawMarketUsd(
                perpsMarketId,
                ERC2771Context._msgSender(),
                amount
            );
        } else {
            ITokenModule synth = ITokenModule(perpsMarketFactory.spotMarket.getSynth(collateralId));
            // withdrawing from a synth market
            perpsMarketFactory.synthetix.withdrawMarketCollateral(
                perpsMarketId,
                address(synth),
                amount
            );
            synth.transfer(ERC2771Context._msgSender(), amount);
        }
    }
}
