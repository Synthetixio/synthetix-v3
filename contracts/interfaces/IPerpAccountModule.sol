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

    // --- Views --- //

    /**
     * @dev Returns a digest of the account including, but not limited to collteral, orders, positions etc.
     */
    function accountDigest(uint128 accountId) external view returns (AccountDigest memory digest);
}
