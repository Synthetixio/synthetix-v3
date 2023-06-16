//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ILiquidationModule {
    error NotEligibleForLiquidation(uint128 accountId);

    function liquidate(uint128 accountId, uint price) external;

    function liquidateFlagged() external;
}
