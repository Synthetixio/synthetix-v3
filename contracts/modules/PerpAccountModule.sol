//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import "../interfaces/IPerpAccountModule.sol";

contract PerpAccountModule is IPerpAccountModule {
    using MarketConfiguration for MarketConfiguration.Data;
    using PerpMarket for PerpMarket.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    function transferCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta) external {
        // Zero change in collateral is a pointless operation.
        if (amountDelta == 0) revert InsufficientCollateral(0, 0);

        // Check if this account exists & correct permissions (How to define market specific permissions?)
        Account.exists(accountId);

        MarketConfiguration.Data storage marketConfig = MarketConfiguration.load();
        uint256 accountCollateral = marketConfig.amountByAccount[accountId];

        // TODO: Check if synthMarketId is a supported collateral type.
        // This can probably be implicitly done by just having 2 separate transferCollateral functions
        // transferSnxUsd
        // transferSnxwstEth

        if (amountDelta > 0) {
            uint256 maxAllowed = marketConfig.amountMaxByCollateral[synthMarketId];
            uint256 marketCollateral = marketConfig.amountByCollateral[synthMarketId];
            // Will adding more collateral exceed max cap or bring below minimum.
            if (marketCollateral + amountDelta.toUint() > maxAllowed)
                revert MaxCollateralExceeded(amountDelta, maxAllowed);
        } else {
            // Are we withdrawing more collateral than what's avalable for the user?
            if (accountCollateral.toInt() < amountDelta)
                revert InsufficientCollateral(accountCollateral.toInt(), amountDelta);
        }

        marketConfig.amountByCollateral[synthMarketId] += amountDelta.toUint();
        marketConfig.amountByAccount[synthMarketId] += amountDelta.toUint();

        // TODO: Add 2 separate transfers because one is usd and the other is snxwstETH which hasn't been impl.
        // synth.transferFrom(msg.sender, address(this), amountDelta.toUint());

        // TODO: Check if an open position can be liquidated and revert with `InsufficientCollateral` if so.

        // PerpMarket.Data storage market = PerpMarket.load();

        // (3) Automatically revert on the transfer if amountDelta is not an available amount
        // (4) Always allow moving collateral into a market
        // - Update how much collateral this account has (internal accounting)
        // - Transfer the `amountDelta` into this contract
        // - Deposit collateral into the core system so it can be used as credit
        // (5) When withdrawing collateral
        // - Do not allow if there is an order currently pending
        // - Check how much available collateral this account is capable of withdrawing (depends on pnl/funding etc.)
        // - Withdraw said collateral from core system
        // - Update internal accounting
        // - If there is an open position, ensure that it isn't put into liquidation
        // - Transfer `amountDelta` back to the user
        // (6) Emit an event
        // (7) Revert on errors
    }
}
