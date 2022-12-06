//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for the minting and burning of stablecoins.
 */
interface IIssueUSDModule {
    /**
     * @notice Emitted when {sender} mints {amount} of snxUSD with the specified staking position.
     * @param accountId The id of the account for which USD was emitted.
     * @param poolId The id of the pool whose collateral was used to emit the USD.
     * @param collateralType The address of the collateral that is backing up the emitted USD.
     * @param amount The amount of USD emitted, denominated with 18 decimals of precision.
     * @param sender The address that triggered the operation.
     */
    event UsdMinted(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint256 amount,
        address indexed sender
    );

    /**
     * @notice Emitted when {sender} burns {amount} of snxUSD with the specified staking position.
     * @param accountId The id of the account for which snxUSD was burned.
     * @param poolId The id of the pool whose collateral was used to emit the USD.
     * @param collateralType The address of the collateral that was backing up the emitted USD.
     * @param amount The amount of USD burnt, denominated with 18 decimals of precision.
     * @param sender The address that triggered the operation.
     */
    event UsdBurned(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint256 amount,
        address indexed sender
    );

    /**
     * @notice Mints {amount} of snxUSD with the specified staking position.
     * @param accountId The id of the account that is minting USD.
     * @param poolId The id of the pool whose collateral will be used to back up the mint.
     * @param collateralType The address of the collateral that will be used to back up the mint.
     * @param amount The amount of USD to be minted, denominated with 18 decimals of precision.
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
        uint256 amount
    ) external;

    /**
     * @notice Burns {amount} of snxUSD with the specified staking position.
     * @param accountId The id of the account that is burning USD.
     * @param poolId The id of the pool whose collateral was used to back up the USD.
     * @param collateralType The address of the collateral that was used to back up the USD.
     * @param amount The amount of USD to be burnt, denominated with 18 decimals of precision.
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
        uint256 amount
    ) external;
}
