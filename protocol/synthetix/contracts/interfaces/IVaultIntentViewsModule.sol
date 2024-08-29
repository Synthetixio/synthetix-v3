//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Views for Delegation Intents for Vault.
 */
interface IVaultIntentViewsModule {
    /**
     * @notice Returns details of the requested intent.
     * @param accountId The id of the account owning the intent.
     * @param intentId The id of the intents.
     * @return poolId The id of the pool associated with the position.
     * @return collateralType The address of the collateral used in the position.
     * @return deltaCollateralAmountD18 The delta amount of collateral delegated in the position, denominated with 18 decimals of precision.
     * @return leverage The new leverage amount used in the position, denominated with 18 decimals of precision.
     * @return declarationTime The time at which the intent was declared.
     * @return processingStartTime The time at which the intent execution window starts.
     * @return processingEndTime The time at which the intent execution window ends.
     */
    function getAccountIntent(
        uint128 accountId,
        uint256 intentId
    )
        external
        view
        returns (
            uint128 poolId,
            address collateralType,
            int256 deltaCollateralAmountD18,
            uint256 leverage,
            uint32 declarationTime,
            uint32 processingStartTime,
            uint32 processingEndTime
        );

    /**
     * @notice Returns the total amount of collateral intended to be delegated to the vault by the account.
     * @param accountId The id of the account owning the intents.
     * @param collateralType The address of the collateral.
     * @return delegatedPerCollateral The total amount of collateral intended to be delegated to the vault by the account, denominated with 18 decimals of precision.
     */
    function getIntentDelegatedPerCollateral(
        uint128 accountId,
        address collateralType
    ) external view returns (uint256 delegatedPerCollateral);

    /**
     * @notice Returns the total amount of collateral intended to be undelegated to the vault by the account.
     * @param accountId The id of the account owning the intents.
     * @param collateralType The address of the collateral.
     * @return undelegatedPerCollateral The total amount of collateral intended to be undelegated to the vault by the account, denominated with 18 decimals of precision.
     */
    function getIntentUndelegatedPerCollateral(
        uint128 accountId,
        address collateralType
    ) external view returns (uint256 undelegatedPerCollateral);

    /**
     * @notice Returns the total executable (not expired) amount of collateral intended to be delegated to the vault by the account.
     * @param accountId The id of the account owning the intents.
     * @param poolId The id of the pool associated with the position.
     * @param collateralType The address of the collateral.
     * @return accumulatedIntentDelta The total amount of collateral intended to be delegated that is not expired, denominated with 18 decimals of precision.
     */
    function getExecutableDelegationAccumulated(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view returns (int256 accumulatedIntentDelta);

    /**
     * @notice Returns the list of executable (by timing) intents for the account.
     * @param accountId The id of the account owning the intents.
     * @param maxProcessableIntent The maximum number of intents to process.
     * @return intentIds The list of intents.
     * @return foundIntents The number of found intents.
     *
     * @dev The array of intent ids might have empty items at the end, use `foundIntents` to know the actual number
     * of valid intents.
     */
    function getAccountExecutableIntentIds(
        uint128 accountId,
        uint256 maxProcessableIntent
    ) external view returns (uint256[] memory intentIds, uint256 foundIntents);

    /**
     * @notice Returns the list of expired (by timing) intents for the account.
     * @param accountId The id of the account owning the intents.
     * @param maxProcessableIntent The maximum number of intents to process.
     * @return intentIds The list of intents.
     * @return foundIntents The number of found intents.
     *
     * @dev The array of intent ids might have empty items at the end, use `foundIntents` to know the actual number
     * of valid intents.
     */
    function getAccountExpiredIntentIds(
        uint128 accountId,
        uint256 maxProcessableIntent
    ) external view returns (uint256[] memory intentIds, uint256 foundIntents);

    /**
     * @notice Returns the list of intents for the account.
     * @param accountId The id of the account owning the intents.
     * @return intentIds The list of intents.
     */
    function getAccountIntentIds(
        uint128 accountId
    ) external view returns (uint256[] memory intentIds);
}
