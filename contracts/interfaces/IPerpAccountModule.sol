//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPerpAccountModule {
    // --- Structs --- //

    struct DepositedCollateral {
        address collateralType;
        uint256 available;
        uint256 oraclePrice;
    }

    struct AccountDigest {
        uint128 accountId;
        uint128 marketId;
        IPerpAccountModule.DepositedCollateral[] depositedCollateral;

        // TODO: Include for details
        //
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
