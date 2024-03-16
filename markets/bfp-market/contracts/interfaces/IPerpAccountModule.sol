//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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
        // Debt of account in USD.
        uint128 debtUsd;
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
        // Funding accrued in USD.
        int256 accruedFunding;
        // Utilization accrued in USD.
        uint256 accruedUtilization;
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

    // --- Events --- //

    // @notice Emitted when two accounts gets merged.
    event AccountMerged(uint128 fromId, uint128 toId, uint128 marketId);

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

    /**
     * @notice Merges two accounts, combining `fromId` into `toId` for `marketId`.
     *
     * Merging accounts will realize the position of account `toId` in addition to transferring collateral and size
     * from one to the other. It's on the caller to burn the perp account NFT post merge.
     *
     * Additionally, this fn requires that account `fromId` must have just been settled, implying account merge
     * operation can only be performed in the same block as settlement via multicalls on settlement or indirectly
     * settlement hooks.
     *
     * We also only allow merging accounts that uses the same collateral as the market.
     *
     * @dev Important that account permmisions in the `fromId` account will _not_ be transferred.
     */
    function mergeAccounts(uint128 fromId, uint128 toId, uint128 marketId) external;
}
