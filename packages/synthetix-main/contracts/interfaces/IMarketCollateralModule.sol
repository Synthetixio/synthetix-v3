//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing market-provided collateral
interface IMarketCollateralModule {
    function depositMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) external;

    function withdrawMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) external;

    function configureMaximumMarketCollateral(
        uint marketId,
        address collateralType,
        uint amount
    ) external;

    function getMaximumMarketCollateral(uint marketId, address collateralType) external returns (uint);

    function getMarketCollateralAmount(uint marketId, address collateralType) external returns (uint);

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is deposited to market `marketId` by `sender`.
     */
    event MarketCollateralDeposited(
        uint indexed marketId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is withdrawn from market `marketId` by `sender`.
     */
    event MarketCollateralWithdrawn(
        uint indexed marketId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );

    event MaximumMarketCollateralConfigured(
        uint indexed marketId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );
}
