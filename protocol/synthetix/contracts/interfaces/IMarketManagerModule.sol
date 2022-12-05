//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title System-wide entry point for the management of markets connected to the system.
 */
interface IMarketManagerModule {
    /**
     * @notice Emitted when a new market is registered in the system.
     * @param market The address of the external market that was registered in the system.
     * @param marketId The id with which the market was registered in the system.
     * @param sender The account that trigger the registration of the market.
     */
    event MarketRegistered(
        address indexed market,
        uint128 indexed marketId,
        address indexed sender
    );

    /**
     * @notice Emitted when a market deposits USD in the system.
     * @param marketId The id of the market that deposited USD in the system.
     * @param target The address of the account that provided the USD in the deposit.
     * @param amount The amount of USD deposited in the system.
     * @param sender The address of the account that triggered the deposit.
     */
    event MarketUsdDeposited(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed sender
    );

    /**
     * @notice Emitted when a market withdraws USD from the system.
     * @param marketId The id of the market that withdrew USD from the system.
     * @param target The address of the account that received the USD in the withdrawal.
     * @param amount The amount of USD withdrew from the system.
     * @param sender The address of the account that triggered the withdrawal.
     */
    event MarketUsdWithdrawn(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed sender
    );

    /**
     * @notice Connects an external market to the system.
     * @dev Creates a Market object to track the external market, and returns the newly crated market id.
     * @param market The address of the external market that is to be registered in the system.
     * @returns The id with which the market will be registered in the system.
     */
    function registerMarket(address market) external returns (uint128);

    /**
     * @notice Allows an external market connected to the system to deposit USD in the system.
     * @dev The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
     * @dev See `IMarket`.
     * @param marketId The id of the market in which USD will be deposited.
     * @param target The address of the account on who's behalf the deposit will be made.
     * @param amount The amount of USD to be deposited.
     */
    function depositMarketUsd(uint128 marketId, address target, uint256 amount) external;

    /**
     * @notice Allows an external market connected to the system to withdraw USD from the system.
     * @dev The system mints the requested USD (provided that the market's USD balance allows it), reduces the market's credit capacity, and increases its issuance.
     * @dev See `IMarket`.
     * @param marketId The id of the market from which USD will be withdrawn.
     * @param target The address of the account that will receive the withdrawn USD.
     * @param amount The amount of USD to be withdraw.
     */
    function withdrawMarketUsd(uint128 marketId, address target, uint256 amount) external;

    /**
     * @notice Returns the total withdrawable USD amount for the specified market.
     * @param marketId The id of the market whose withdrawable USD amount is being queried.
     * @returns The total amount of USD that the market could withdraw at the time of the query.
     */
    function getWithdrawableUsd(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the net issuance of the specified market (USD withdrawn - USD deposited).
     * @param marketId The id of the market whose net issuance is being queried.
     * @returns The net issuance of the market.
     */
    function getMarketNetIssuance(uint128 marketId) external view returns (int128);

    /**
     * @notice Returns the reported debt of the specified market.
     * @param marketId The if of the market whose reported debt is being queried.
     * @returns The market's reported debt.
     */
    function getMarketReportedDebt(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the total debt of the specified market.
     * @param marketId The id of the market whose debt is being queried.
     * @returns The total debt of the market.
     */
    function getMarketTotalDebt(uint128 marketId) external view returns (int256);

    /**
     * @notice Returns the total collateral for the specified market.
     * @param marketId The id of the market whose collateral is being queried.
     * @returns The market's total collateral.
     */
    function getMarketCollateral(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the value per share of the debt of the specified market.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @param marketId The id of the market whose debt per share is being queried.
     * @returns The market's debt per share value.
     */
    function getMarketDebtPerShare(uint128 marketId) external returns (int256);

    /**
     * @notice Returns wether the capacity of the specified market is locked.
     * @param marketId The id of the market whose capacity is being queried.
     * @returns A boolean that is true if the market's capacity is locked at the time of the query.
     */
    function isMarketCapacityLocked(uint128 marketId) external view returns (bool);
}
