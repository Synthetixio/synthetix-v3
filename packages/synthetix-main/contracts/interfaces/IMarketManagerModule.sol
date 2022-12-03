//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MarketManagerModule interface.
 * @notice System-wide entry point for the management of markets connected to the system.
 */
interface IMarketManagerModule {
    event MarketRegistered(address indexed market, uint128 indexed marketId);
    event MarketUsdDeposited(uint128 indexed marketId, address indexed target, uint amount, address indexed sender);
    event MarketUsdWithdrawn(uint128 indexed marketId, address indexed target, uint amount, address indexed sender);

    /**
     * @dev Connects an external market to the system.
     * @dev Creates a Market object to track the external market, and returns the newly crated market id.
     */
    function registerMarket(address market) external returns (uint128);

    /**
     * @notice Allows an external market connected to the system to deposit USD in the system.
     * @dev The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
     * @dev See `IMarket`.
     */
    /// @notice target deposits amount of synths to the marketId
    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external;

    /**
     * @notice Allows an external market connected to the system to withdraw USD from the system.
     * @dev The system mints the requested USD (provided that the market's USD balance allows it), reduces the market's credit capacity, and increases its issuance.
     * @dev See `IMarket`.
     */
    /// @notice target withdraws amount of synths to the marketId
    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external;

    /**
     * @notice Returns the total withdrawable USD amount for the specified market.
     */
    function getWithdrawableUsd(uint128 marketId) external view returns (uint);

    /**
     * @notice Returns the net issuance of the specified market (USD withdrawn - USD deposited).
     */
    function getMarketNetIssuance(uint128 marketId) external view returns (int128);

    /**
     * @notice Returns the reported debt of the specified market.
     */
    /// @notice gets the total balance of the market
    function getMarketReportedDebt(uint128 marketId) external view returns (uint);

    /**
     * @notice Returns the total debt of the specified market.
     */
    /// @notice gets the total balance of the market (marketIssuance + marketReportedDebt)
    function getMarketTotalDebt(uint128 marketId) external view returns (int);

    /**
     * @notice Returns the total collateral for the specified market.
     */
    /// @notice gets the snxUSD value of the collateral backing this market.
    function getMarketCollateral(uint128 marketId) external view returns (uint);

    /**
     * @notice Returns the value per share of the debt of the specified market.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     */
    function getMarketDebtPerShare(uint128 marketId) external returns (int);

    /**
     * @notice Returns wether the capacity of the specified market is locked.
     */
    function isMarketCapacityLocked(uint128 marketId) external view returns (bool);
}
