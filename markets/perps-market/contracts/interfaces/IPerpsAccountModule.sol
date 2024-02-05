//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Account module
 */
interface IPerpsAccountModule {
    /**
     * @notice Gets fired when an account colateral is modified.
     * @param accountId Id of the account.
     * @param synthMarketId Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
     * @param amountDelta requested change in amount of collateral delegated to the account.
     * @param sender address of the sender of the size modification. Authorized by account owner.
     */
    event CollateralModified(
        uint128 indexed accountId,
        uint128 indexed synthMarketId,
        int256 amountDelta,
        address indexed sender
    );

    /**
     * @notice Gets thrown when the amount delta is zero.
     */
    error InvalidAmountDelta(int256 amountDelta);

    /**
     * @notice Modify the collateral delegated to the account.
     * @param accountId Id of the account.
     * @param synthMarketId Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
     * @param amountDelta requested change in amount of collateral delegated to the account.
     */
    function modifyCollateral(
        uint128 accountId,
        uint128 synthMarketId,
        int256 amountDelta
    ) external;

    /**
     * @notice Gets the account's collateral value for a specific collateral.
     * @param accountId Id of the account.
     * @param synthMarketId Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
     * @return collateralValue collateral value of the account.
     */
    function getCollateralAmount(
        uint128 accountId,
        uint128 synthMarketId
    ) external view returns (uint256);

    /**
     * @notice Gets the account's collaterals ids
     * @param accountId Id of the account.
     */
    function getAccountCollateralIds(uint128 accountId) external view returns (uint256[] memory);

    /**
     * @notice Gets all markets that a given account id has a position in
     * @param accountId Id of the account.
     */
    function getAccountOpenPositions(uint128 accountId) external view returns (uint256[] memory);

    /**
     * @notice Gets the account's total collateral value without the discount applied.
     * @param accountId Id of the account.
     * @return collateralValue total collateral value of the account without discount. USD denominated.
     */
    function totalCollateralValue(uint128 accountId) external view returns (uint256);

    /**
     * @notice Gets the account's total open interest value.
     * @param accountId Id of the account.
     * @return openInterestValue total open interest value of the account.
     */
    function totalAccountOpenInterest(uint128 accountId) external view returns (uint256);

    /**
     * @notice Gets the details of an open position.
     * @param accountId Id of the account.
     * @param marketId Id of the position market.
     * @return totalPnl pnl of the entire position including funding.
     * @return accruedFunding accrued funding of the position.
     * @return positionSize size of the position.
     * @return owedInterest interest owed due to open position.
     */
    function getOpenPosition(
        uint128 accountId,
        uint128 marketId
    )
        external
        view
        returns (int256 totalPnl, int256 accruedFunding, int128 positionSize, uint256 owedInterest);

    /**
     * @notice Gets an account open position data for a given account id and market id
     * @notice this function doesn't have any price staleness requirement
     * @param accountId Id of the account.
     * @param marketId Id of the position market.
     */
    function getOpenPositionSize(
        uint128 accountId,
        uint128 marketId
    ) external view returns (int128 positionSize);

    /**
     * @notice Gets the available margin of an account. It can be negative due to pnl.
     * @param accountId Id of the account.
     * @return availableMargin available margin of the position.
     */
    function getAvailableMargin(uint128 accountId) external view returns (int256 availableMargin);

    /**
     * @notice Gets the exact withdrawable amount a trader has available from this account while holding the account's current positions.
     * @param accountId Id of the account.
     * @return withdrawableMargin available margin to withdraw.
     */
    function getWithdrawableMargin(
        uint128 accountId
    ) external view returns (int256 withdrawableMargin);

    /**
     * @notice Gets the initial/maintenance margins across all positions that an account has open.
     * @dev Note that requiredInitialMargin and requiredMaintenanceMargin includes the liquidation rewards, in case you want the value without it you need to substract maxLiquidationReward.
     * @param accountId Id of the account.
     * @return requiredInitialMargin initial margin req (used when withdrawing collateral).
     * @return requiredMaintenanceMargin maintenance margin req (used to determine liquidation threshold).
     * @return maxLiquidationReward max liquidation reward the keeper would receive if account was fully liquidated. Note here that the accumulated rewards are checked against the global max/min configured liquidation rewards.
     */
    function getRequiredMargins(
        uint128 accountId
    )
        external
        view
        returns (
            uint256 requiredInitialMargin,
            uint256 requiredMaintenanceMargin,
            uint256 maxLiquidationReward
        );
}
