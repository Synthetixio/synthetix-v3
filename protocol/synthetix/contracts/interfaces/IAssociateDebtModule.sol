//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

/**
 * @title Module for associating debt with the system.
 * @notice Allows a market to associate debt to a user's existing position.
 * E.g. when migrating a position from v2 into v3's legacy market, the market first scales up everyone's debt, and then associates it to a position using this module.
 */
interface IAssociateDebtModule {
    /**
     * @notice Emitted when `associateDebt` is called.
     */
    event DebtAssociated(
        uint128 indexed marketId,
        uint128 indexed poolId,
        address indexed collateralType,
        uint128 accountId,
        uint amount,
        int updatedDebt
    );

    /**
     * @notice Allows a market to associate debt with a specific position.
     */
    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint amount
    ) external returns (int);
}
