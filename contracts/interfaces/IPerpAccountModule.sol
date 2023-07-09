//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// TODO: Consider rebuilding this as a 'IPerpCollateralModule'.
//
// What is even an account? It's really just an abstraction (as most account specific functionality is managed by
// the core Account module in Synthetix). From the POV of bfp, an account is just an accountId associated with downstream
// resources. Downstream resources have their own respective modules (orders, liquidations, positions etc.), so the
// argument is why not have collateral its own module?
//
// There might be account specific views and those can exist within an IPerpAccountModule but the movement and tracking
// of collateral associated by account should be in a IPerpCollateralModule.
interface IPerpAccountModule {
    // --- Structs --- //

    struct AccountDigest {
        uint128 accountId;
        // TODO: Include for details
        //
        // Deposited collateral and the price of each
        // Any open positions associated with this account
        // Any pending orders associated with this account
    }

    // --- Events --- //

    // @dev Emitted when collateral is transferred between user <-> Account.
    event TransferCollateral(address indexed from, address indexed to, int256 value);

    // --- Mutative --- //

    /**
     * @dev Transfers snxUSD into an existing PerpAccount.
     *
     * A negative `amountDelta` is a withdraw. A variety of errors are thrown if limits or collateral
     * issues are found. A transfer, even when there is no open position will immediately deposit the
     * collateral into the Synthetix core system.
     *
     * Core system allows _any_ collateral to be depoisted via `depositMarketCollateral`. However, for this to
     * work, each collateral _needs_ an oracle node. This is referenced thruogh an `oracleNodeId`. There are
     * also limitations on the maximum amount that can be deposited per market. Additionally, collaterals must
     * be enabled through `depositingEnabled`.
     *
     * So, seemingly, for this to work, the core system must allow wstETH as collateral before first. As of
     * writing, there are only two collateral types configured, SNX and WETH but WETH is disabled.
     *
     * There are no fees associated with the transfer of collateral.
     */
    function transferCollateral(uint128 accountId, uint128 marketId, address collateral, int256 amountDelta) external;

    // --- Views --- //

    /**
     * @dev Returns a digest of the account including, but not limited to collteral, orders, positions etc.
     */
    function accountDigest(uint128 accountId) external view returns (AccountDigest memory digest);
}
