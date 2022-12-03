//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for the minting and burning of stablecoins.
 */
interface IIssueUSDModule {
    /**
     * @notice Emitted when {sender} mints {amount} of snxUSD with the specified staking position.
     */
    event UsdMinted(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Emitted when {sender} burns {amount} of snxUSD with the specified staking position.
     */
    event UsdBurned(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Mints {amount} of snxUSD with the specified staking position.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission.
     * - After minting, the collateralization ratio of the staking position must not be below the target collateralization ratio for the corresponding collateral type.
     *
     * Emits a {UsdMinted} event.
     */
    function mintUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint amount
    ) external;

    /**
     * @notice Burns {amount} of snxUSD with the specified staking position.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `BURN` permission.
     *
     * Emits a {UsdMinted} event.
     */
    function burnUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint amount
    ) external;
}
