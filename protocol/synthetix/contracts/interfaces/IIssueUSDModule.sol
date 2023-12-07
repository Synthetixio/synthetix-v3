//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for the minting and burning of stablecoinss.
 */
interface IIssueUSDModule {
    /**
     * @notice Thrown when an account does not have sufficient debt to burn USD.
     */
    error InsufficientDebt(int256 currentDebt);

    /**
     * @notice Emitted when {sender} mints {amount} of stablecoins with the specified liquidity position.
     * @param accountId The id of the account for which stablecoins was emitted.
     * @param poolId The id of the pool whose collateral was used to emit the stablecoins.
     * @param collateralType The address of the collateral that is backing up the emitted stablecoins.
     * @param amount The amount of stablecoins emitted, denominated with 18 decimals of precision.
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
     * @notice Emitted when {sender} burns {amount} of stablecoins with the specified liquidity position.
     * @param accountId The id of the account for which stablecoins was burned.
     * @param poolId The id of the pool whose collateral was used to emit the stablecoins.
     * @param collateralType The address of the collateral that was backing up the emitted stablecoins.
     * @param amount The amount of stablecoins burned, denominated with 18 decimals of precision.
     * @param sender The address that triggered the operation.
     */
    event UsdBurned(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint256 amount,
        address indexed sender
    );

    event IssuanceFeePaid(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint256 feeAmount
    );

    /**
     * @notice Mints {amount} of stablecoins with the specified liquidity position.
     * @param accountId The id of the account that is minting stablecoins.
     * @param poolId The id of the pool whose collateral will be used to back up the mint.
     * @param collateralType The address of the collateral that will be used to back up the mint.
     * @param amount The amount of stablecoins to be minted, denominated with 18 decimals of precision.
     *
     * Requirements:
     *
     * - `ERC2771Context._msgSender()` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission.
     * - After minting, the collateralization ratio of the liquidity position must not be below the target collateralization ratio for the corresponding collateral type.
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
     * @notice Burns {amount} of stablecoins with the specified liquidity position.
     * @param accountId The id of the account that is burning stablecoins.
     * @param poolId The id of the pool whose collateral was used to back up the stablecoins.
     * @param collateralType The address of the collateral that was used to back up the stablecoins.
     * @param amount The amount of stablecoins to be burnt, denominated with 18 decimals of precision.
     *
     * Emits a {UsdBurned} event.
     */
    function burnUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 amount
    ) external;

    /**
     * @notice Burns all debt for the specified liquidity position.
     * @param accountId The id of the account that is burning stablecoins.
     * @param poolId The id of the pool whose collateral was used to back up the stablecoins.
     * @param collateralType The address of the collateral that was used to back up the stablecoins.
     *
     */
    function clearDebt(uint128 accountId, uint128 poolId, address collateralType) external;
}
