//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {PerpCollateral} from "../storage/PerpCollateral.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import "../interfaces/IPerpAccountModule.sol";

contract PerpAccountModule is IPerpAccountModule {
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    /**
     * @inheritdoc IPerpAccountModule
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory digest) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        PerpCollateral.GlobalData storage collateralConfig = PerpCollateral.load();
        PerpCollateral.Data storage accountCollaterals = PerpCollateral.load(accountId, marketId);

        uint256 length = collateralConfig.supportedAddresses.length;
        IPerpAccountModule.DepositedCollateral[] memory collateral = new DepositedCollateral[](length);

        for (uint256 i = 0; i < length; ) {
            address collateralType = collateralConfig.supportedAddresses[i];
            collateral[i] = IPerpAccountModule.DepositedCollateral({
                collateralType: collateralType,
                available: accountCollaterals.available[collateralType],
                oraclePrice: PerpCollateral.getOraclePrice(collateralType)
            });
            unchecked {
                i++;
            }
        }

        uint256 collateralUsd = PerpCollateral.getCollateralUsd(accountId, marketId);
        Position.Data storage position = market.positions[accountId];

        digest = IPerpAccountModule.AccountDigest({
            accountId: accountId,
            marketId: marketId,
            collateral: collateral,
            collateralUsd: collateralUsd,
            order: market.orders[accountId],
            position: position,
            healthFactor: position.getHealthFactor(
                collateralUsd,
                market.getOraclePrice(),
                PerpMarketConfiguration.load(marketId)
            )
        });
    }
}
