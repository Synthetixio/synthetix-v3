//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title System-wide entry point for the management of markets connected to the system.
 */
interface IMarketManagerModule {
    /**
     * @notice Thrown when a market does not have enough liquidity for a withdrawal.
     */
    error NotEnoughLiquidity(uint128 marketId, uint256 amount);

    /**
     * @notice Thrown when an attempt to register a market that does not conform to the IMarket interface is made.
     */
    error IncorrectMarketInterface(address market);

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
     * @notice Emitted when a market deposits snxUSD in the system.
     * @param marketId The id of the market that deposited snxUSD in the system.
     * @param target The address of the account that provided the snxUSD in the deposit.
     * @param amount The amount of snxUSD deposited in the system, denominated with 18 decimals of precision.
     * @param market The address of the external market that is depositing.
     */
    event MarketUsdDeposited(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed market
    );

    /**
     * @notice Emitted when a market withdraws snxUSD from the system.
     * @param marketId The id of the market that withdrew snxUSD from the system.
     * @param target The address of the account that received the snxUSD in the withdrawal.
     * @param amount The amount of snxUSD withdrawn from the system, denominated with 18 decimals of precision.
     * @param market The address of the external market that is withdrawing.
     */
    event MarketUsdWithdrawn(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed market
    );

    /**
     * @notice Connects an external market to the system.
     * @dev Creates a Market object to track the external market, and returns the newly created market id.
     * @param market The address of the external market that is to be registered in the system.
     * @return The id with which the market will be registered in the system.
     */
    function registerMarket(address market) external returns (uint128);

    /**
     * @notice Allows an external market connected to the system to deposit USD in the system.
     * @dev The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
     * @dev See `IMarket`.
     * @param marketId The id of the market in which snxUSD will be deposited.
     * @param target The address of the account on who's behalf the deposit will be made.
     * @param amount The amount of snxUSD to be deposited, denominated with 18 decimals of precision.
     */
    function depositMarketUsd(uint128 marketId, address target, uint256 amount) external;

    /**
     * @notice Allows an external market connected to the system to withdraw snxUSD from the system.
     * @dev The system mints the requested snxUSD (provided that the market has sufficient credit), reduces the market's credit capacity, and increases its net issuance.
     * @dev See `IMarket`.
     * @param marketId The id of the market from which snxUSD will be withdrawn.
     * @param target The address of the account that will receive the withdrawn snxUSD.
     * @param amount The amount of snxUSD to be withdraw, denominated with 18 decimals of precision.
     */
    function withdrawMarketUsd(uint128 marketId, address target, uint256 amount) external;

    /**
     * @notice Returns the total withdrawable snxUSD amount for the specified market.
     * @param marketId The id of the market whose withdrawable USD amount is being queried.
     * @return The total amount of snxUSD that the market could withdraw at the time of the query, denominated with 18 decimals of precision.
     */
    function getWithdrawableUsd(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the net issuance of the specified market (snxUSD withdrawn - snxUSD deposited).
     * @param marketId The id of the market whose net issuance is being queried.
     * @return The net issuance of the market, denominated with 18 decimals of precision.
     */
    function getMarketNetIssuance(uint128 marketId) external view returns (int128);

    /**
     * @notice Returns the reported debt of the specified market.
     * @param marketId The id of the market whose reported debt is being queried.
     * @return The market's reported debt, denominated with 18 decimals of precision.
     */
    function getMarketReportedDebt(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the total debt of the specified market.
     * @param marketId The id of the market whose debt is being queried.
     * @return The total debt of the market, denominated with 18 decimals of precision.
     */
    function getMarketTotalDebt(uint128 marketId) external view returns (int256);

    /**
     * @notice Returns the total snxUSD value of the collateral for the specified market.
     * @param marketId The id of the market whose collateral is being queried.
     * @return The market's total snxUSD value of collateral, denominated with 18 decimals of precision.
     */
    function getMarketCollateral(uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the value per share of the debt of the specified market.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @param marketId The id of the market whose debt per share is being queried.
     * @return The market's debt per share value, denominated with 18 decimals of precision.
     */
    function getMarketDebtPerShare(uint128 marketId) external returns (int256);

    /**
     * @notice Returns wether the capacity of the specified market is locked.
     * @param marketId The id of the market whose capacity is being queried.
     * @return A boolean that is true if the market's capacity is locked at the time of the query.
     */
    function isMarketCapacityLocked(uint128 marketId) external view returns (bool);
}
