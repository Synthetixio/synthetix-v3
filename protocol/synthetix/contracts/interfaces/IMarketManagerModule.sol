//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title System-wide entry point for the management of markets connected to the system.
 */
interface IMarketManagerModule {
    /**
     * @notice Emitted when a new market is registered in the system.
     */
    event MarketRegistered(
        address indexed market,
        uint128 indexed marketId,
        address indexed sender
    );

    /**
     * @notice Emitted when a market deposits USD in the system.
     */
    event MarketUsdDeposited(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed sender
    );

    /**
     * @notice Emitted when a market withdraws USD from the system.
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
     */
    function registerMarket(address market) external returns (uint128);

    /**
     * @notice Allows an external market connected to the system to deposit USD in the system.
     * @dev The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
     * @dev See `IMarket`.
     */
    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint256 amount
    ) external;

    /**
     * @notice Allows an external market connected to the system to withdraw USD from the system.
     * @dev The system mints the requested USD (provided that the market's USD balance allows it), reduces the market's credit capacity, and increases its issuance.
     * @dev See `IMarket`.
     */
    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint256 amount
    ) external;

    /**
     * @notice Returns the total withdrawable USD amount for the specified market.
     */
    function getWithdrawableUsd(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the net issuance of the specified market (USD withdrawn - USD deposited).
     */
    function getMarketNetIssuance(uint128 marketId) external view returns (int128);

    /**
     * @notice Returns the reported debt of the specified market.
     */
    function getMarketReportedDebt(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the total debt of the specified market.
     */
    function getMarketTotalDebt(uint128 marketId) external view returns (int256);

    /**
     * @notice Returns the total collateral for the specified market.
     */
    function getMarketCollateral(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the value per share of the debt of the specified market.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     */
    function getMarketDebtPerShare(uint128 marketId) external returns (int256);

    /**
     * @notice Returns wether the capacity of the specified market is locked.
     */
    function isMarketCapacityLocked(uint128 marketId) external view returns (bool);
}
