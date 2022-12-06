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
     * @param marketId The id of the market to which debt was associated.
     * @param poolId The id of the pool associated to the target market.
     * @param collateralType The address of the collateral type that acts as collateral in the corresponding pool.
     * @param accountId The id of the account whose debt is being associated.
     * @param amount The amount of debt being associated with the specified account, denominated with 18 decimals of precision.
     * @param updatedDebt The total updated debt of the account, denominated with 18 decimals of precision
     */
    event DebtAssociated(
        uint128 indexed marketId,
        uint128 indexed poolId,
        address indexed collateralType,
        uint128 accountId,
        uint256 amount,
        int256 updatedDebt
    );

    /**
     * @notice Allows a market to associate debt with a specific position.
     * @param marketId The id of the market to which debt was associated.
     * @param poolId The id of the pool associated to the target market.
     * @param collateralType The address of the collateral type that acts as collateral in the corresponding pool.
     * @param accountId The id of the account whose debt is being associated.
     * @param amount The amount of debt being associated with the specified account, denominated with 18 decimals of precision.
     * @return The updated debt of the position, denominated with 18 decimals of precision.
     */
    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint256 amount
    ) external returns (int256);
}
