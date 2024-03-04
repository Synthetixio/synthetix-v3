//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {Price} from "@synthetixio/spot-market/contracts/storage/Price.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IPerpsAccountModule} from "../interfaces/IPerpsAccountModule.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {Position} from "../storage/Position.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {QuantoUint256, USDInt256, USDUint256} from 'quanto-dimensions/src/UnitTypes.sol';

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
        uint128 synthMarketId,
        int256 amountDelta
    ) external override {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

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
            account.validateWithdrawableAmount(
                synthMarketId,
                amountAbs,
                perpsMarketFactory.spotMarket
            );
            _withdrawMargin(perpsMarketFactory, perpsMarketId, synthMarketId, amountAbs);
        }

        // accounting
        account.updateCollateralAmount(synthMarketId, amountDelta);

        emit CollateralModified(accountId, synthMarketId, amountDelta, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function totalCollateralValue(uint128 accountId) external view override returns (uint256) {
        return PerpsAccount.load(accountId).getTotalCollateralValue(PerpsPrice.Tolerance.DEFAULT).unwrap();
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function totalAccountOpenInterest(uint128 accountId) external view override returns (uint256) {
        return PerpsAccount.load(accountId).getTotalNotionalOpenInterest();
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
            PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT).unwrap()
        );
        return (totalPnl, accruedFunding, position.size.unwrap(), owedInterest);
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getAvailableMargin(
        uint128 accountId
    ) external view override returns (USDInt256 availableMargin) {
        availableMargin = PerpsAccount.load(accountId).getAvailableMargin(
            PerpsPrice.Tolerance.DEFAULT
        );
    }

    /**
     * @inheritdoc IPerpsAccountModule
     */
    function getWithdrawableMargin(
        uint128 accountId
    ) external view override returns (USDInt256 withdrawableMargin) {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        USDInt256 availableMargin = account.getAvailableMargin(PerpsPrice.Tolerance.DEFAULT);
        (USDUint256 initialRequiredMargin, , USDUint256 liquidationReward) = account
            .getAccountRequiredMargins(PerpsPrice.Tolerance.DEFAULT);

        USDUint256 requiredMargin = initialRequiredMargin + liquidationReward;

        withdrawableMargin = availableMargin - USDInt256.wrap(requiredMargin.unwrap().toInt());
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
            USDUint256 requiredInitialMargin,
            USDUint256 requiredMaintenanceMargin,
            USDUint256 maxLiquidationReward
        )
    {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (account.openPositionMarketIds.length() == 0) {
            return (USDUint256.wrap(0), USDUint256.wrap(0), USDUint256.wrap(0));
        }

        (requiredInitialMargin, requiredMaintenanceMargin, maxLiquidationReward) = account
            .getAccountRequiredMargins(PerpsPrice.Tolerance.DEFAULT);

        // Include liquidation rewards to required initial margin and required maintenance margin
        requiredInitialMargin = requiredInitialMargin + maxLiquidationReward;
        requiredMaintenanceMargin = requiredMaintenanceMargin + maxLiquidationReward;
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
        uint128 synthMarketId,
        uint256 amount
    ) internal {
        if (synthMarketId == SNX_USD_MARKET_ID) {
            // depositing into the USD market
            perpsMarketFactory.synthetix.depositMarketUsd(
                perpsMarketId,
                ERC2771Context._msgSender(),
                amount
            );
        } else {
            ITokenModule synth = ITokenModule(
                perpsMarketFactory.spotMarket.getSynth(synthMarketId)
            );
            synth.transferFrom(ERC2771Context._msgSender(), address(this), amount);
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
        if (synthMarketId == SNX_USD_MARKET_ID) {
            // withdrawing from the USD market
            perpsMarketFactory.synthetix.withdrawMarketUsd(
                perpsMarketId,
                ERC2771Context._msgSender(),
                amount
            );
        } else {
            ISpotMarketSystem spotMarket = perpsMarketFactory.spotMarket;
            ITokenModule synth = ITokenModule(
                spotMarket.getSynth(synthMarketId)
            );

            uint256 collateralAmount = perpsMarketFactory.synthetix.getMarketCollateralAmount(
                perpsMarketId,
                address(synth)
            );

            // can withdraw all the payout from the markets collateral directly
            if (collateralAmount >= amount) {
                // withdraw this markets trader deposited synth collateral
                perpsMarketFactory.synthetix.withdrawMarketCollateral(
                    perpsMarketId,
                    address(synth),
                    amount
                );
            } else {
                // TODO: potentially move this logic to the position settlement, instead of withdrawal time
                // withdraw all available market collateral
                perpsMarketFactory.synthetix.withdrawMarketCollateral(
                    perpsMarketId,
                    address(synth),
                    collateralAmount
                );

                // workout how much sUSD is needed to buy the remaining synths
                uint256 amountOfSynthToBuy = amount - collateralAmount;
                (uint256 costOfSynthInUSD, ) = spotMarket.quoteBuyExactOut(
                    synthMarketId,
                    amountOfSynthToBuy,
                    Price.Tolerance.DEFAULT // TODO: check correct price tolerance
                );

                // borrow sUSD from the pool to buy the remaining synths
                perpsMarketFactory.synthetix.withdrawMarketUsd(
                    perpsMarketId,
                    address(this),
                    costOfSynthInUSD
                );

                // buy the remaining synths needed to payout the trader
                perpsMarketFactory.usdToken.approve(address(spotMarket), costOfSynthInUSD);
                spotMarket.buyExactOut(
                    synthMarketId,
                    amountOfSynthToBuy,
                    costOfSynthInUSD,
                    address(0) // TODO: change refferer to KWENTA?
                );
            }

            synth.transfer(ERC2771Context._msgSender(), amount);
        }
    }
}
