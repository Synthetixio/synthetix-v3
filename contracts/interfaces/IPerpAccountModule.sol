//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";

interface IPerpAccountModule {
    // --- Structs --- //

    struct DepositedCollateral {
        // @dev Address of the collateral deposited
        address collateralType;
        // @dev Amount of available collateral deposited (unrelated to position)
        uint256 available;
        // @dev Oracle price of collateral
        uint256 oraclePrice;
    }

    struct AccountDigest {
        // @dev Array of data pertaining to deposited collateral
        IPerpAccountModule.DepositedCollateral[] collateral;
        // @dev Notional value of deposited collateral in USD.
        uint256 collateralUsd;
        // @dev Struct of order if one is pending, default values if none.
        Order.Data order;
        // @dev Struct of PositionDigest if a position is open, default values if none.
        PositionDigest position;
    }

    struct PositionDigest {
        // @dev id of the account that was queried.
        uint128 accountId;
        // @dev id of the market that was queried.
        uint128 marketId;
        // @dev Total remaining margin for position in USD.
        uint256 marginUsd;
        // @dev Health factor for position in market if a position is open.
        uint256 healthFactor;
        // @dev Notional value of position in USD.
        uint256 notionalValueUsd;
        // @dev Unrealized PnL of position in USD.
        int256 unrealizedPnl;
        // @dev funding accrued in USD.
        int256 accruedFunding;
        // @dev  Entry price of the position.
        uint256 entryPrice;
        // @dev Current price
        uint256 oraclePrice;
        // @dev Position size
        int128 size;
    }

    // --- Views --- //

    /**
     * @dev Returns a digest of the account including, but not limited to collateral, orders, positions etc.
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory);

    /**
     * @dev Returns a digest of an open position belonging to `accountId` in `marketId`.
     */
    function getPositionDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.PositionDigest memory);
}
