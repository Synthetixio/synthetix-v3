//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Allows accounts to delegate collateral to a pool.
 * @dev Delegation updates the account's position in the vault that corresponds to the associated pool and collateral type pair.
 * @dev A pool contains one vault for each collateral type it supports, and vaults are not shared between pools.
 */
interface IVaultModule {
    /**
     * @notice Thrown when attempting to delegate collateral to a vault with a leverage amount that is not supported by the system.
     */
    error InvalidLeverage(uint256 leverage);

    /**
     * @notice Thrown when attempting to delegate collateral to a market whose capacity is locked.
     */
    error CapacityLocked(uint256 marketId);

    /**
     * @notice Thrown when the specified new collateral amount to delegate to the vault equals the current existing amount.
     */
    error InvalidCollateralAmount();

    /**
     * @notice Emitted when {sender} updates the delegation of collateral in the specified liquidity position.
     * @param accountId The id of the account whose position was updated.
     * @param poolId The id of the pool in which the position was updated.
     * @param collateralType The address of the collateral associated to the position.
     * @param amount The new amount of the position, denominated with 18 decimals of precision.
     * @param leverage The new leverage value of the position, denominated with 18 decimals of precision.
     * @param sender The address that triggered the update of the position.
     */
    event DelegationUpdated(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address collateralType,
        uint256 amount,
        uint256 leverage,
        address indexed sender
    );

    /**
     * @notice Updates an account's delegated collateral amount for the specified pool and collateral type pair.
     * @param accountId The id of the account associated with the position that will be updated.
     * @param poolId The id of the pool associated with the position.
     * @param collateralType The address of the collateral used in the position.
     * @param amount The new amount of collateral delegated in the position, denominated with 18 decimals of precision.
     * @param leverage The new leverage amount used in the position, denominated with 18 decimals of precision.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission.
     * - If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account.
     * - If decreasing the amount delegated, the liquidity position must have a collateralization ratio greater than the target collateralization ratio for the corresponding collateral type.
     *
     * Emits a {DelegationUpdated} event.
     */
    function delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 amount,
        uint256 leverage
    ) external;

    /**
     * @notice Returns the collateralization ratio of the specified liquidity position. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     * @param accountId The id of the account whose collateralization ratio is being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return ratioD18 The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.
     */
    function getPositionCollateralRatio(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (uint256 ratioD18);

    /**
     * @notice Returns the debt of the specified liquidity position. Credit is expressed as negative debt.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @param accountId The id of the account being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return debtD18 The amount of debt held by the position, denominated with 18 decimals of precision.
     */
    function getPositionDebt(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (int256 debtD18);

    /**
     * @notice Returns the amount and value of the collateral associated with the specified liquidity position.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     * @param accountId The id of the account being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return collateralAmountD18 The amount of collateral used in the position, denominated with 18 decimals of precision.
     * @return collateralValueD18 The value of collateral used in the position, denominated with 18 decimals of precision.
     */
    function getPositionCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view returns (uint256 collateralAmountD18, uint256 collateralValueD18);

    /**
     * @notice Returns all information pertaining to a specified liquidity position in the vault module.
     * @param accountId The id of the account being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return collateralAmountD18 The amount of collateral used in the position, denominated with 18 decimals of precision.
     * @return collateralValueD18 The value of the collateral used in the position, denominated with 18 decimals of precision.
     * @return debtD18 The amount of debt held in the position, denominated with 18 decimals of precision.
     * @return collateralizationRatioD18 The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.
     **/
    function getPosition(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    )
        external
        returns (
            uint256 collateralAmountD18,
            uint256 collateralValueD18,
            int256 debtD18,
            uint256 collateralizationRatioD18
        );

    /**
     * @notice Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @param poolId The id of the pool that owns the vault whose debt is being queried.
     * @param collateralType The address of the collateral of the associated vault.
     * @return debtD18 The overall debt of the vault, denominated with 18 decimals of precision.
     **/
    function getVaultDebt(uint128 poolId, address collateralType) external returns (int256 debtD18);

    /**
     * @notice Returns the amount and value of the collateral held by the vault.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     * @param poolId The id of the pool that owns the vault whose collateral is being queried.
     * @param collateralType The address of the collateral of the associated vault.
     * @return collateralAmountD18 The collateral amount of the vault, denominated with 18 decimals of precision.
     * @return collateralValueD18 The collateral value of the vault, denominated with 18 decimals of precision.
     */
    function getVaultCollateral(
        uint128 poolId,
        address collateralType
    ) external returns (uint256 collateralAmountD18, uint256 collateralValueD18);

    /**
     * @notice Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     * @param poolId The id of the pool that owns the vault whose collateralization ratio is being queried.
     * @param collateralType The address of the collateral of the associated vault.
     * @return ratioD18 The collateralization ratio of the vault, denominated with 18 decimals of precision.
     */
    function getVaultCollateralRatio(
        uint128 poolId,
        address collateralType
    ) external returns (uint256 ratioD18);
}
