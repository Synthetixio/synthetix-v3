//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPerpAccountModule {
    // --- Errors --- //
    error InsufficientCollateral(int256 accountCollateral, int256 amountDelta);
    error MaxCollateralExceeded(int256 amountDelta, uint256 maxCollateral);

    function transferCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta) external;
}
