//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IPerpAccountModule} from "../interfaces/IPerpAccountModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";

contract PerpAccountModule is IPerpAccountModule {
    using DecimalMath for uint256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;

    // --- Runtime structs --- //
    struct Runtime_getPositionDigest {
        uint256 oraclePrice;
        uint256 healthFactor;
        int256 accruedFunding;
        int256 pnl;
        uint256 remainingMarginUsd;
    }

    /**
     * @inheritdoc IPerpAccountModule
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        IPerpAccountModule.DepositedCollateral[] memory depositedCollaterals = new DepositedCollateral[](length);
        uint128 synthMarketId;
        uint256 collateralPrice;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            collateralPrice = globalMarginConfig.getCollateralPrice(synthMarketId, globalConfig);
            depositedCollaterals[i] = IPerpAccountModule.DepositedCollateral(
                synthMarketId,
                accountMargin.collaterals[synthMarketId],
                collateralPrice
            );

            unchecked {
                ++i;
            }
        }

        return
            IPerpAccountModule.AccountDigest(
                depositedCollaterals,
                Margin.getCollateralUsd(accountId, marketId, false /* useHaircutCollateralPrice */),
                market.orders[accountId],
                getPositionDigest(accountId, marketId)
            );
    }

    /**
     * @inheritdoc IPerpAccountModule
     */
    function getPositionDigest(
        uint128 accountId,
        uint128 marketId
    ) public view returns (IPerpAccountModule.PositionDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        Runtime_getPositionDigest memory runtime;
        runtime.oraclePrice = market.getOraclePrice();

        (runtime.healthFactor, runtime.accruedFunding, runtime.pnl, runtime.remainingMarginUsd) = Position
            .getHealthData(
                market,
                position.size,
                position.entryPrice,
                position.entryFundingAccrued,
                Margin.getMarginUsd(accountId, market, runtime.oraclePrice, true /* useHaircutCollateralPrice */),
                runtime.oraclePrice,
                marketConfig
            );
        (uint256 im, uint256 mm, ) = Position.getLiquidationMarginUsd(position.size, runtime.oraclePrice, marketConfig);

        return
            IPerpAccountModule.PositionDigest(
                accountId,
                marketId,
                runtime.remainingMarginUsd,
                runtime.healthFactor,
                MathUtil.abs(position.size).mulDecimal(runtime.oraclePrice), // notionalValueUsd
                runtime.pnl,
                position.accruedFeesUsd,
                runtime.accruedFunding,
                position.entryPrice,
                runtime.oraclePrice,
                position.size,
                im,
                mm
            );
    }
}
