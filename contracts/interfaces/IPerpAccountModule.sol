//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPerpAccountModule {
    // --- Data Structures --- //

    struct AccountDigest {
        uint128 accountId;
        // TODO: Include for details
        //
        // Deposited collateral and the price of each
        // Any open positions associated with this account
        // Any pending orders associated with this account
    }

    // --- Errors --- //

    error InsufficientCollateral(int256 accountCollateral, int256 amountDelta);
    error MaxCollateralExceeded(int256 amountDelta, uint256 maxCollateral);

    // --- Mutative --- //

    /**
     * @dev Transfers snxUSD into an existing PerpAccount.
     *
     * A negative `amountDelta` is a withdraw. A variety of errors are thrown if limits or collateral
     * issues are found. A transfer, even when there is no open position will immediately deposit the
     * collateral into the Synthetix core system.
     *
     * There are no fees associated with the transfer of collateral.
     */
    function transferUsd(uint128 accountId, uint128 marketId, int256 amountDelta) external;

    /**
     * @dev Transfers wstETH into an existing PerpAccount.
     *
     * Structurally, this behaves very similarly to `transferUsd` except, it reads from wstETH. This
     * piece is still TBD.
     *
     * Core system allows _any_ collateral to be depoisted via `depositMarketCollateral`. However, for this to
     * work, each collateral _needs_ an oracle node. This is referenced thruogh an `oracleNodeId`. There are
     * also limitations on the maximum amount that can be deposited per market. Additionally, collaterals must
     * be enabled through `depositingEnabled`.
     *
     * So, seemingly, for this to work, the core system must allow wstETH as collateral before first.
     */
    function transferWsteth(uint128 accountId, uint128 marketId, int256 amountDelta) external;

    // --- Views --- //

    /**
     * @dev Returns a digest of the account including, but not limited to collteral, orders, positions etc.
     */
    function accountDigest(uint128 accountId) external view returns (AccountDigest memory digest);
}
