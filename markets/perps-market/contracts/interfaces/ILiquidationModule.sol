//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ILiquidationModule {
    function liquidate(uint128 accountId) external;

    function liquidateFlagged() external;
}
