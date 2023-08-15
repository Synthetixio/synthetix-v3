//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";

import "../interfaces/IPerpAccountModule.sol";

contract PerpAccountModule is IPerpAccountModule {
    using DecimalMath for uint256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    /**
     * @inheritdoc IPerpAccountModule
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedAddresses.length;
        IPerpAccountModule.DepositedCollateral[] memory collateral = new DepositedCollateral[](length);
        address collateralType;

        for (uint256 i = 0; i < length; ) {
            collateralType = globalMarginConfig.supportedAddresses[i];
            collateral[i] = IPerpAccountModule.DepositedCollateral(
                collateralType,
                accountMargin.collaterals[collateralType],
                Margin.getOraclePrice(collateralType)
            );
            unchecked {
                i++;
            }
        }

        return
            IPerpAccountModule.AccountDigest(
                collateral,
                Margin.getCollateralUsd(accountId, marketId),
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

        uint256 price = market.getOraclePrice();
        (uint256 healthFactor, int256 accruedFunding, int256 pnl, uint256 remainingMarginUsd) = position.getHealthData(
            market,
            Margin.getMarginUsd(accountId, market, price),
            price,
            PerpMarketConfiguration.load(marketId)
        );
        uint256 notional = MathUtil.abs(position.size).mulDecimal(price);

        return
            IPerpAccountModule.PositionDigest(
                accountId,
                marketId,
                remainingMarginUsd,
                healthFactor,
                notional,
                pnl,
                accruedFunding,
                position.entryPrice,
                price,
                position.size
            );
    }
}
