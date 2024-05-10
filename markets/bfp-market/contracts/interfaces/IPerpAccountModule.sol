//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPerpAccountModule {
    // --- Structs --- //

    struct DepositedCollateral {
        /// Address of the collateral.
        address collateralAddress;
        /// Amount of available collateral deposited (unrelated to position).
        uint256 available;
        /// Unadjusted oracle price of collateral.
        uint256 oraclePrice;
    }

    struct AccountDigest {
        /// Array of collateral deposited into account as margin.
        IPerpAccountModule.DepositedCollateral[] depositedCollaterals;
        /// USD value of deposited collateral.
        uint256 collateralUsd;
        /// Debt of account in USD.
        uint128 debtUsd;
        /// Struct of `PositionDigest` if a position is open, default values if none.
        PositionDigest position;
    }

    struct PositionDigest {
        /// Id of the account that was queried.
        uint128 accountId;
        /// Id of the market that was queried.
        uint128 marketId;
        /// Total remaining margin for position in USD.
        uint256 remainingMarginUsd;
        /// Health factor for position in market if a position is open.
        uint256 healthFactor;
        /// Notional value of position in USD.
        uint256 notionalValueUsd;
        /// Unrealized PnL of position in USD.
        int256 pnl;
        /// Funding accrued in USD.
        int256 accruedFunding;
        /// Utilization accrued in USD.
        uint256 accruedUtilization;
        /// Raw Pyth entry price of position (at open or on modification).
        uint256 entryPythPrice;
        /// pd-adjusted entry price of position (at open or on modification).
        uint256 entryPrice;
        /// Current oracle price of market this position.
        uint256 oraclePrice;
        /// Position size in native units (not USD).
        int128 size;
        /// Initial margin (IM) requirement.
        uint256 im;
        /// Maintenance margin (MM) requirement.
        uint256 mm;
    }

    // --- Events --- //

    /// @notice Emitted when two accounts are merged.
    /// @param fromId Account to merge from
    /// @param toId Account to merge into
    /// @param marketId Market to perform the account merge
    event AccountsMerged(uint128 indexed fromId, uint128 indexed toId, uint128 indexed marketId);

    /// @notice Emitted when an account is split into a new one.
    /// @param fromId Account to split from
    /// @param toId Account to split into
    /// @param marketId Market to perform the account split
    event AccountSplit(uint128 indexed fromId, uint128 indexed toId, uint128 indexed marketId);

    // --- Views --- //

    /// @notice Returns a digest of the account including, but not limited to collateral, orders, positions etc.
    /// @param accountId Account of digest to query against
    /// @param marketId Market of account digest to query against
    /// @return getAccountDigest A struct of `AccountDigest` with account details
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory);

    /// @notice Returns a digest of an open position belonging to `accountId` in `marketId`.
    /// @param accountId Account of position
    /// @param marketId Market position belongs to
    /// @return getPositionDigest A struct of `PositionDigest` with position details
    function getPositionDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.PositionDigest memory);

    /// @notice Merges two accounts, combining `fromId` into `toId` for `marketId`. Merging accounts will realize the
    ///         position of account `toId` in addition to transferring collateral and size from one to the other. It's
    ///         on the caller to burn the perp account NFT post merge.
    ///         Additionally, this fn requires that account `fromId` must have just been settled, implying account
    ///         merge operation can only be performed in the same block as settlement via multicalls on settlement or
    ///         indirectly settlement hooks.
    /// @param fromId Account to merge from
    /// @param toId Account to merge into
    /// @param marketId Market to perform the account merge
    /// @dev Account permissions in the `fromId` account are _not_ be transferred and that we only allow
    ///      merging accounts that use the same margin collateral as the market.
    function mergeAccounts(uint128 fromId, uint128 toId, uint128 marketId) external;

    /// @notice Splits the from accounts size, collateral and debt based on the proportion provided.
    /// @param fromId Account to split from
    /// @param toId Account to split into
    /// @param marketId Market to perform the split account
    /// @param proportion Portion of `fromId` to split out, expressed as a decimal (e.g 0.5 = half)
    /// @dev Account permissions in the `fromId` account will _not_ be transferred. This also requires the `toId` to
    ///      be an empty account.
    function splitAccount(
        uint128 fromId,
        uint128 toId,
        uint128 marketId,
        uint128 proportion
    ) external;
}
