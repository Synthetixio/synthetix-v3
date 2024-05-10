//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IBasePerpMarket} from "./IBasePerpMarket.sol";
import {Margin} from "../storage/Margin.sol";

interface IMarginModule is IBasePerpMarket {
    // --- Structs --- //

    struct ConfiguredCollateral {
        /// Address of the collateral asset.
        address collateralAddress;
        /// The underlying spot market synth sell oracle node id.
        bytes32 oracleNodeId;
        /// Maximum allowable deposited amount.
        uint128 maxAllowable;
        /// Skew skewScale for the collateral.
        uint128 skewScale;
        /// Address of the associated reward distributor.
        address rewardDistributor;
    }

    // --- Events --- //

    /// @notice Emitted when margin is deposited from user to market.
    /// @param from Address of depositor
    /// @param to Address of recipient of deposit
    /// @param value Amount of assets deposited
    /// @param collateralAddress Address of collateral deposited
    event MarginDeposit(
        address indexed from,
        address indexed to,
        uint256 value,
        address collateralAddress
    );

    /// @notice Emitted when margin is withdrawn from market to user.
    /// @param from Address of recipient of withdraw
    /// @param to Address where asset withdrawn from
    /// @param value Amount of assets withdrawn
    /// @param collateralAddress Address of withdrawn asset
    event MarginWithdraw(
        address indexed from,
        address indexed to,
        uint256 value,
        address collateralAddress
    );

    /// @notice Emitted when collateral is configured.
    /// @param from Address collateral configurer
    /// @param collaterals Number of collaterals configured
    event MarginCollateralConfigured(address indexed from, uint256 collaterals);

    /// @notice Emitted when debt is paid off.
    /// @param accountId Account that had their debt paid
    /// @param marketId Market of account that had their debt paid
    /// @param oldDebt Debt in USD before debt payment
    /// @param newDebt Debt in USD after debt payment
    /// @param paidFromUsdCollateral Amount of debt paid directly from USD in margin
    event DebtPaid(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint128 oldDebt,
        uint128 newDebt,
        uint128 paidFromUsdCollateral
    );

    // --- Mutations --- //

    /// @notice Pay debt belonging to `accountId` and `marketId` with sUSD available in margin. Users can partially pay
    ///         off their debt. If the amount is larger than the available debt, only the delta will be withdrawn from
    ///         margin.
    /// @notice sUSD held in margin takes precedence over those in the caller's wallet.
    /// @param accountId Account of the margin to pay debt on
    /// @param marketId Market of the margin to pay debt on
    /// @param amount USD amount of debt to pay off
    function payDebt(uint128 accountId, uint128 marketId, uint128 amount) external;

    /// @notice Withdraws all deposited margin collateral for `accountId` and `marketId`.
    /// @param accountId Account of the margin account to withdraw from
    /// @param marketId Market of the margin account to withdraw from
    /// @dev Will revert if account has open positions, pending orders, or any unpaid debt.
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external;

    /// @notice Modifies the `collateralAddress` margin for `accountId` on `marketId` by the `amountDelta`. A negative amount
    ///         signifies a withdraw and positive is deposit. A variety of errors are thrown if limits or collateral
    ///         issues are found.
    /// @param accountId Account to modify margin collateral against
    /// @param marketId Market to modify margin collateral against
    /// @param collateralAddress Address of collateral to deposit or withdraw
    /// @param amountDelta Amount of synths to deposit or withdraw
    /// @dev Modifying collateral will immediately deposit collateral into the Synthetix core system.
    function modifyCollateral(
        uint128 accountId,
        uint128 marketId,
        address collateralAddress,
        int256 amountDelta
    ) external;

    /// @notice Configure with collateral types, their max allowables (deposits),their skewScale and reward
    ///         distributors. This function will reconfigure _all_ collaterals and replace the existing
    ///         collateral set with new collaterals supplied.
    /// @param collateralAddresses An array of collateral addresses.
    /// @param oracleNodeIds An array of oracle nods for each collateral
    /// @param maxAllowables An array of integers to indicate the global maximum deposit amount
    /// @param skewScales An array of integers for skew scales for each collateral
    /// @param rewardDistributors An array of addresses to each reward distributor
    function setMarginCollateralConfiguration(
        address[] calldata collateralAddresses,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables,
        uint128[] calldata skewScales,
        address[] calldata rewardDistributors
    ) external;

    /// @notice Set the max allowable for existing collateral by `collateralAddress`.
    /// @param collateralAddress Collateral asset to configure
    /// @param maxAllowable New max deposit amount for the synth
    function setCollateralMaxAllowable(address collateralAddress, uint128 maxAllowable) external;

    // --- Views --- //

    /// @notice Returns the configured collaterals useable for margin.
    /// @return getMarginCollateralConfiguration An array of `ConfiguredCollateral` structs representing configured collateral
    function getMarginCollateralConfiguration()
        external
        view
        returns (ConfiguredCollateral[] memory);

    /// @notice Returns a digest of account margin USD values. See `Margin.MarginValues` for specifics.
    /// @param accountId Account of margin to query against
    /// @param marketId Market of margin to query against
    /// @return getMarginDigest A struct of relevant margin values in USD
    function getMarginDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (Margin.MarginValues memory);

    /// @notice Returns the NAV of `account` and `marketId` given an optional `price`.
    /// @param accountId Account of position to query against
    /// @param marketId Market of position to query against
    /// @param oraclePrice Market oracle price, uint256(0) will default to current price
    /// @return getNetAssetValue The NAV of the current position in USD
    function getNetAssetValue(
        uint128 accountId,
        uint128 marketId,
        uint256 oraclePrice
    ) external view returns (uint256);

    /// @notice Returns the discount adjusted oracle price based on `amount` of collateral for `collateralAddress`. `amount` is
    ///         necessary here as it simulates if `amount` were sold, what would be the impact on the skew, and
    ///         hence the discount.
    /// @param collateralAddress Address of collateral asset
    /// @param amount Amount of synth asset to sell
    /// @return getDiscountedCollateralPrice Discounted collateral price in USD
    function getDiscountedCollateralPrice(
        address collateralAddress,
        uint256 amount
    ) external view returns (uint256);

    /// @notice Returns the withdrawable margin given the discounted margin for `accountId` accounting for any open
    ///         position. Callers can invoke `getMarginDigest` to retrieve the available margin (i.e. discounted margin
    ///         when there is a position open or marginUsd when there isn't).
    /// @param accountId Account of the margin account to query against
    /// @param marketId Market of the margin account to query against
    /// @return getWithdrawableMargin Amount of margin in USD that can be withdrawn
    function getWithdrawableMargin(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256);

    /// @notice Returns the keeper reward for liquidating a position's margin
    /// @param accountId Account of the margin to be liquidated
    /// @param marketId Market of the margin to be liquidated
    /// @return getMarginLiquidationOnlyReward Amount of keeper rewards in USD
    function getMarginLiquidationOnlyReward(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256);
}
