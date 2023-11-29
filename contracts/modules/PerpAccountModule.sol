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
                Margin.getCollateralUsd(accountId, marketId, false /* useHaicutCollateralPrice=false */),
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

        uint256 oraclePrice = market.getOraclePrice();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        (uint256 healthFactor, int256 accruedFunding, int256 pnl, uint256 remainingMarginUsd) = position.getHealthData(
            market,
            Margin.getMarginUsd(accountId, market, oraclePrice, true /* useHaircutCollateralPrice=true */),
            oraclePrice,
            marketConfig
        );
        uint256 notionalValueUsd = MathUtil.abs(position.size).mulDecimal(oraclePrice);
        (uint256 im, uint256 mm, ) = Position.getLiquidationMarginUsd(position.size, oraclePrice, marketConfig);

        return
            IPerpAccountModule.PositionDigest(
                accountId,
                marketId,
                remainingMarginUsd,
                healthFactor,
                notionalValueUsd,
                pnl,
                position.accruedFeesUsd,
                accruedFunding,
                position.entryPrice,
                oraclePrice,
                position.size,
                im,
                mm
            );
    }
}
