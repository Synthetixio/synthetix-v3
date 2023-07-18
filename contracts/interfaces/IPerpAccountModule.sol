//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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

    // --- Views --- //

    /**
     * @dev Returns a digest of the account including, but not limited to collateral, orders, positions etc.
     */
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory digest);
}
