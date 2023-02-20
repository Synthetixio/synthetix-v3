//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for associating debt with the system.
 * @notice Allows a market to associate debt to a user's existing position.
 * E.g. when migrating a position from v2 into v3's legacy market, the market first scales up everyone's debt, and then associates it to a position using this module.
 */
interface IAssociateDebtModule {
    /**
     * @notice Thrown when the specified market is not connected to the specified pool in debt association.
     */
    error NotFundedByPool(uint256 marketId, uint256 poolId);

    /**
     * @notice Thrown when a debt association would shift a position below the liquidation ratio.
     */
    error InsufficientCollateralRatio(
        uint256 collateralValue,
        uint256 debt,
        uint256 ratio,
        uint256 minRatio
    );

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
     * The specified debt will be removed from all vault participants pro-rata. After removing the debt, the amount will
     * be allocated directly to the specified account.
     * **NOTE**: if the specified account is an existing staker on the vault, their position will be included in the pro-rata
     * reduction. Ex: if there are 10 users staking 10 USD of debt on a pool, and associate debt is called with 10 USD on one of those users,
     * their debt after the operation is complete will be 19 USD. This might seem unusual, but its actually ideal behavior when
     * your market has incurred some new debt, and it wants to allocate this amount directly to a specific user. In this case, the user's
     * debt balance would increase pro rata, but then get decreased pro-rata, and then increased to the full amount on their account. All
     * other accounts would be left with no change to their debt, however.
     * @param marketId The id of the market to which debt was associated.
     * @param poolId The id of the pool associated to the target market.
     * @param collateralType The address of the collateral type that acts as collateral in the corresponding pool.
     * @param accountId The id of the account whose debt is being associated.
     * @param amount The amount of debt being associated with the specified account, denominated with 18 decimals of precision.
     * @return debtAmount The updated debt of the position, denominated with 18 decimals of precision.
     */
    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint256 amount
    ) external returns (int256 debtAmount);
}
