//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing market-provided collateral
interface IMarketCollateralModule {
    function depositMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external;

    function withdrawMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external;

    function configureMaximumMarketCollateral(
        uint128 marketId,
        address collateralType,
        uint amount
    ) external;

    function getMaximumMarketCollateral(uint128 marketId, address collateralType) external returns (uint);

    function getMarketCollateralAmount(uint128 marketId, address collateralType) external returns (uint);

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is deposited to market `marketId` by `sender`.
     */
    event MarketCollateralDeposited(
        uint128 indexed marketId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is withdrawn from market `marketId` by `sender`.
     */
    event MarketCollateralWithdrawn(
        uint128 indexed marketId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );

    event MaximumMarketCollateralConfigured(
        uint128 indexed marketId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );
}
