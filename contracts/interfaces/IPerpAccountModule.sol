//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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
        // @dev id of the account that was queried
        uint128 accountId;
        // @dev id of the market that was queried
        uint128 marketId;
        // @dev Array of data pertaining to deposited collateral
        IPerpAccountModule.DepositedCollateral[] depositedCollateral;
        // @dev Struct of order if one is pending, default values if none.
        Order.Data order;
        // @dev Struct of position if one is open, default values if none.
        Position.Data position;
    }

    // --- Views --- //

    /**
     * @dev Returns a digest of the account including, but not limited to collateral, orders, positions etc.
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory digest);
}
