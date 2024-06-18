//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "./external/IOracleManager.sol";

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
     * @param creditCapacity Updated credit capacity of the market after depositing.
     * @param netIssuance Updated net issuance.
     * @param depositedCollateralValue Updated deposited collateral value of the market.
     */
    event MarketUsdDeposited(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed market,
        int128 creditCapacity,
        int128 netIssuance,
        uint256 depositedCollateralValue
    );

    /**
     * @notice Emitted when a market withdraws snxUSD from the system.
     * @param marketId The id of the market that withdrew snxUSD from the system.
     * @param target The address of the account that received the snxUSD in the withdrawal.
     * @param amount The amount of snxUSD withdrawn from the system, denominated with 18 decimals of precision.
     * @param market The address of the external market that is withdrawing.
     * @param creditCapacity Updated credit capacity of the market after withdrawing.
     * @param netIssuance Updated net issuance.
     * @param depositedCollateralValue Updated deposited collateral value of the market
     */
    event MarketUsdWithdrawn(
        uint128 indexed marketId,
        address indexed target,
        uint256 amount,
        address indexed market,
        int128 creditCapacity,
        int128 netIssuance,
        uint256 depositedCollateralValue
    );

    event MarketSystemFeePaid(uint128 indexed marketId, uint256 feeAmount);

    /**
     * @notice Emitted when a market sets an updated minimum delegation time
     * @param marketId The id of the market that the setting is applied to
     * @param minDelegateTime The minimum amount of time between delegation changes
     */
    event SetMinDelegateTime(uint128 indexed marketId, uint32 minDelegateTime);

    /**
     * @notice Emitted when a market-specific minimum liquidity ratio is set
     * @param marketId The id of the market that the setting is applied to
     * @param minLiquidityRatio The new market-specific minimum liquidity ratio
     */
    event SetMarketMinLiquidityRatio(uint128 indexed marketId, uint256 minLiquidityRatio);

    /**
     * @notice Connects an external market to the system.
     * @dev Creates a Market object to track the external market, and returns the newly created market id.
     * @param market The address of the external market that is to be registered in the system.
     * @return newMarketId The id with which the market will be registered in the system.
     */
    function registerMarket(address market) external returns (uint128 newMarketId);

    /**
     * @notice Allows an external market connected to the system to deposit USD in the system.
     * @dev The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
     * @dev See `IMarket`.
     * @param marketId The id of the market in which snxUSD will be deposited.
     * @param target The address of the account on who's behalf the deposit will be made.
     * @param amount The amount of snxUSD to be deposited, denominated with 18 decimals of precision.
     * @return feeAmount the amount of fees paid (billed as additional debt towards liquidity providers)
     */
    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint256 amount
    ) external returns (uint256 feeAmount);

    /**
     * @notice Allows an external market connected to the system to withdraw snxUSD from the system.
     * @dev The system mints the requested snxUSD (provided that the market has sufficient credit), reduces the market's credit capacity, and increases its net issuance.
     * @dev See `IMarket`.
     * @param marketId The id of the market from which snxUSD will be withdrawn.
     * @param target The address of the account that will receive the withdrawn snxUSD.
     * @param amount The amount of snxUSD to be withdraw, denominated with 18 decimals of precision.
     * @return feeAmount the amount of fees paid (billed as additional debt towards liquidity providers)
     */
    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint256 amount
    ) external returns (uint256 feeAmount);

    /**
     * @notice Get the amount of fees paid in USD for a call to `depositMarketUsd` and `withdrawMarketUsd` for the given market and amount
     * @param marketId The market to check fees for
     * @param amount The amount deposited or withdrawn in USD
     * @return depositFeeAmount the amount of USD paid for a call to `depositMarketUsd`
     * @return withdrawFeeAmount the amount of USD paid for a call to `withdrawMarketUsd`
     */
    function getMarketFees(
        uint128 marketId,
        uint256 amount
    ) external view returns (uint256 depositFeeAmount, uint256 withdrawFeeAmount);

    /**
     * @notice Returns the total withdrawable snxUSD amount for the specified market.
     * @param marketId The id of the market whose withdrawable USD amount is being queried.
     * @return withdrawableD18 The total amount of snxUSD that the market could withdraw at the time of the query, denominated with 18 decimals of precision.
     */
    function getWithdrawableMarketUsd(
        uint128 marketId
    ) external view returns (uint256 withdrawableD18);

    /**
     * @notice Returns the contract address for the specified market.
     * @param marketId The id of the market
     * @return marketAddress The contract address for the specified market
     */
    function getMarketAddress(uint128 marketId) external view returns (address marketAddress);

    /**
     * @notice Returns the net issuance of the specified market (snxUSD withdrawn - snxUSD deposited).
     * @param marketId The id of the market whose net issuance is being queried.
     * @return issuanceD18 The net issuance of the market, denominated with 18 decimals of precision.
     */
    function getMarketNetIssuance(uint128 marketId) external view returns (int128 issuanceD18);

    /**
     * @notice Returns the reported debt of the specified market.
     * @param marketId The id of the market whose reported debt is being queried.
     * @return reportedDebtD18 The market's reported debt, denominated with 18 decimals of precision.
     */
    function getMarketReportedDebt(
        uint128 marketId
    ) external view returns (uint256 reportedDebtD18);

    /**
     * @notice Returns the total debt of the specified market.
     * @param marketId The id of the market whose debt is being queried.
     * @return totalDebtD18 The total debt of the market, denominated with 18 decimals of precision.
     */
    function getMarketTotalDebt(uint128 marketId) external view returns (int256 totalDebtD18);

    /**
     * @notice Returns the total snxUSD value of the collateral for the specified market.
     * @param marketId The id of the market whose collateral is being queried.
     * @return valueD18 The market's total snxUSD value of collateral, denominated with 18 decimals of precision.
     */
    function getMarketCollateral(uint128 marketId) external view returns (uint256 valueD18);

    /**
     * @notice Returns the value per share of the debt of the specified market.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @param marketId The id of the market whose debt per share is being queried.
     * @return debtPerShareD18 The market's debt per share value, denominated with 18 decimals of precision.
     */
    function getMarketDebtPerShare(uint128 marketId) external returns (int256 debtPerShareD18);

    /**
     * @notice Returns whether the capacity of the specified market is locked.
     * @param marketId The id of the market whose capacity is being queried.
     * @return isLocked A boolean that is true if the market's capacity is locked at the time of the query.
     */
    function isMarketCapacityLocked(uint128 marketId) external view returns (bool isLocked);

    /**
     * @notice Returns the USD token associated with this synthetix core system
     */
    function getUsdToken() external view returns (IERC20);

    /**
     * @notice Retrieve the systems' configured oracle manager address
     */
    function getOracleManager() external view returns (IOracleManager);

    /**
     * @notice Update a market's current debt registration with the system.
     * This function is provided as an escape hatch for pool griefing, preventing
     * overwhelming the system with a series of very small pools and creating high gas
     * costs to update an account.
     * @param marketId the id of the market that needs pools bumped
     * @return finishedDistributing whether or not all bumpable pools have been bumped and target price has been reached
     */
    function distributeDebtToPools(
        uint128 marketId,
        uint256 maxIter
    ) external returns (bool finishedDistributing);

    /**
     * @notice allows for a market to set its minimum delegation time. This is useful for preventing stakers from frontrunning rewards or losses
     * by limiting the frequency of `delegateCollateral` (or `setPoolConfiguration`) calls. By default, there is no minimum delegation time.
     * @param marketId the id of the market that wants to set delegation time.
     * @param minDelegateTime the minimum number of seconds between delegation calls. Note: this value must be less than the globally defined maximum minDelegateTime
     */
    function setMarketMinDelegateTime(uint128 marketId, uint32 minDelegateTime) external;

    /**
     * @notice Retrieve the minimum delegation time of a market
     * @param marketId the id of the market
     */
    function getMarketMinDelegateTime(uint128 marketId) external view returns (uint32);

    /**
     * @notice Allows the system owner (not the pool owner) to set a market-specific minimum liquidity ratio.
     * @param marketId the id of the market
     * @param minLiquidityRatio The new market-specific minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)
     */
    function setMinLiquidityRatio(uint128 marketId, uint256 minLiquidityRatio) external;

    /**
     * @notice Retrieves the market-specific minimum liquidity ratio.
     * @param marketId the id of the market
     * @return minRatioD18 The current market-specific minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)
     */
    function getMinLiquidityRatio(uint128 marketId) external view returns (uint256 minRatioD18);

    function getMarketPools(
        uint128 marketId
    ) external returns (uint128[] memory inRangePoolIds, uint128[] memory outRangePoolIds);

    function getMarketPoolDebtDistribution(
        uint128 marketId,
        uint128 poolId
    ) external returns (uint256 sharesD18, uint128 totalSharesD18, int128 valuePerShareD27);
}
