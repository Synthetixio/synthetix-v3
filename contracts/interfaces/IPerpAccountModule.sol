//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";

interface IPerpAccountModule {
    // --- Structs --- //

    struct DepositedCollateral {
        // Id of the spot synth market collateral.
        uint128 synthMarketId;
        // Amount of available collateral deposited (unrelated to position).
        uint256 available;
        // Unadjusted oracle price of collateral.
        uint256 oraclePrice;
    }

    struct AccountDigest {
        // Array of collateral deposited into account as margin.
        IPerpAccountModule.DepositedCollateral[] depositedCollaterals;
        // USD value of deposited collateral.
        uint256 collateralUsd;
        // Struct of order if one is pending, default values if none.
        Order.Data order;
        // Struct of `PositionDigest` if a position is open, default values if none.
        PositionDigest position;
    }

    struct PositionDigest {
        // Id of the account that was queried.
        uint128 accountId;
        // Id of the market that was queried.
        uint128 marketId;
        // Total remaining margin for position in USD.
        uint256 remainingMarginUsd;
        // Health factor for position in market if a position is open.
        uint256 healthFactor;
        // Notional value of position in USD.
        uint256 notionalValueUsd;
        // Unrealized PnL of position in USD.
        int256 pnl;
        // Fees incurred to settle position (e.g. keeper/order).
        uint256 accruedFeesUsd;
        // Funding accrued in USD.
        int256 accruedFunding;
        // Entry price of the position (either at open or on modification).
        uint256 entryPrice;
        // Current oracle price of market this position.
        uint256 oraclePrice;
        // Position size in native units (not USD).
        int128 size;
        // Initial margin (IM) requirement.
        uint256 im;
        // Maintenance margin (MM) requirement.
        uint256 mm;
    }

    // --- Views --- //

    /**
     * @notice Returns a digest of the account including, but not limited to collateral, orders, positions etc.
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory);

    /**
     * @notice Returns a digest of an open position belonging to `accountId` in `marketId`.
     */
    function getPositionDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.PositionDigest memory);
}
