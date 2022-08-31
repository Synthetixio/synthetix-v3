//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/PoolVaultStorage.sol";

/// @title Module for staking positions in vaults
interface IVaultModule {
    /**
     * @notice Emitted when {sender} updates the delegation of collateral in the specified staking position.
     */
    event DelegationUpdated(
        uint indexed accountId,
        uint indexed poolId,
        address collateralType,
        uint amount,
        uint leverage,
        address indexed sender
    );

    /**
     * @notice Emitted when {sender} mints {amount} of snxUSD with the specified staking position.
     */
    event UsdMinted(
        uint indexed accountId,
        uint indexed poolId,
        address collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Emitted when {sender} burns {amount} of snxUSD with the specified staking position.
     */
    event UsdBurned(
        uint indexed accountId,
        uint indexed poolId,
        address collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Delegates (creates, adjust or remove a delegation) collateral from an account.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission.
     * - If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account.
     * - If decreasing the amount delegated, the staking position must have a colalteralization ratio greater than the target collateralization ratio for the corresponding collateral type.
     *
     * Emits a {DelegationUpdated} event.
     */
    function delegateCollateral(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount,
        uint leverage
    ) external;

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
        uint accountId,
        uint poolId,
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
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount
    ) external;

    /**
     * @notice Returns the collateralization ratio of the specified staking position. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     */
    function getPositionCollateralizationRatio(
        uint accountId,
        uint poolId,
        address collateralType
    ) external returns (uint);

    /**
     * @notice Returns the debt of the specified staking position. Credit is expressed as negative debt.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is denominated in dollars with 18 decimal places.
     */
    function getPositionDebt(
        uint accountId,
        uint poolId,
        address collateralType
    ) external returns (int);

    /**
     * @notice Returns the amount and value of the collateral associated with the specified staking position.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     */
    function getPositionCollateral(
        uint accountId,
        uint poolId,
        address collateralType
    ) external view returns (uint collateralAmount, uint collateralValue);

    /**
     * @notice Returns the number of shares associated with the specified staking position.
     * @dev The return value is represented as an integer with 18 decimals.
     **/
    function getPositionVaultShares(
        uint accountId,
        uint poolId,
        address collateralType
    ) external view returns (uint);

    /**
     * @notice Returns all information pertaining to a specified staking position in the vault module.
     **/
    function getPosition(
        uint accountId,
        uint poolId,
        address collateralType
    )
        external
        returns (
            uint collateralAmount,
            uint collateralValue,
            uint vaultShares,
            int debt,
            uint collateralizationRatio
        );

    /**
     * @notice Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is denominated in dollars with 18 decimal places.
     **/
    function getVaultDebt(uint poolId, address collateralType) external returns (int);

    /**
     * @notice Returns the amount and value of the collateral held by the vault.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     */
    function getVaultCollateral(uint poolId, address collateralType)
        external
        returns (uint collateralAmount, uint collateralValue);

    /**
     * @notice Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     */
    function getVaultCollateralRatio(uint poolId, address collateralType) external returns (uint);

    /**
     * @notice Returns the total number of shares issued by this vault.
     * @dev The return value is represented as an integer with 18 decimals.
     **/
    function getVaultShares(uint poolId, address collateralType) external view returns (uint);
}
