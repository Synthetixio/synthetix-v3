//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

@/**
 * @title MarketCollateralModule interface.
 * @notice System module for allowing markets to directly increase their credit capacity by providing their own collateral.
 */
interface IMarketCollateralModule {
    @/**
     * @notice Allows a market to deposit collateral.
     */
    function depositMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external;

    @/**
     * @notice Allows a market to withdraw collateral that it has previously deposited.
     */
    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external;

    @/**
     * @notice Allow the system owner to configure the maximum amount of a given collateral type that a specified market is allowed to deposit.
     */
    function configureMaximumMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external;

    @/**
     * @notice Return the total maximum amount of a given collateral type that a specified market is allowed to deposit.
     */
    function getMaximumMarketCollateral(uint128 marketId, address collateralType) external returns (uint);

    @/**
     * @notice Return the total amount of a given collateral type that a specified market has deposited.
     */
    function getMarketCollateralAmount(uint128 marketId, address collateralType) external returns (uint);

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is deposited to market `marketId` by `sender`.
     */
    event MarketCollateralDeposited(
        uint128 indexed marketId,
        address indexed collateralType,
        uint tokenAmount,
        address indexed sender
    );

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is withdrawn from market `marketId` by `sender`.
     */
    event MarketCollateralWithdrawn(
        uint128 indexed marketId,
        address indexed collateralType,
        uint tokenAmount,
        address indexed sender
    );

    event MaximumMarketCollateralConfigured(
        uint128 indexed marketId,
        address indexed collateralType,
        uint systemAmount,
        address indexed sender
    );
}
