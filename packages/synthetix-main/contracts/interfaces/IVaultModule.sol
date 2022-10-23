//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for staking positions in vaults
interface IVaultModule {
    /**
     * @notice Emitted when {sender} updates the delegation of collateral in the specified staking position.
     */
    event DelegationUpdated(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint amount,
        uint leverage,
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
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint amount,
        uint leverage
    ) external;

    /**
     * @notice Returns the collateralization ratio of the specified staking position. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     */
    function getPositionCollateralizationRatio(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (uint);

    /**
     * @notice Returns the debt of the specified staking position. Credit is expressed as negative debt.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is denominated in dollars with 18 decimal places.
     */
    function getPositionDebt(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (int);

    /**
     * @notice Returns the amount and value of the collateral associated with the specified staking position.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     */
    function getPositionCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view returns (uint collateralAmount, uint collateralValue);

    /**
     * @notice Returns all information pertaining to a specified staking position in the vault module.
     **/
    function getPosition(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    )
        external
        returns (
            uint collateralAmount,
            uint collateralValue,
            int debt,
            uint collateralizationRatio
        );

    /**
     * @notice Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is denominated in dollars with 18 decimal places.
     **/
    function getVaultDebt(uint128 poolId, address collateralType) external returns (int);

    /**
     * @notice Returns the amount and value of the collateral held by the vault.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     */
    function getVaultCollateral(uint128 poolId, address collateralType)
        external
        returns (uint collateralAmount, uint collateralValue);

    /**
     * @notice Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     */
    function getVaultCollateralRatio(uint128 poolId, address collateralType) external returns (uint);
}
