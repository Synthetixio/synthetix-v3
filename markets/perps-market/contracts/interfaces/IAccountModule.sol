//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Account module
 */
interface IAccountModule {
    function totalCollateralValue(uint128 accountId) external view returns (uint);

    function totalAccountOpenInterest(uint128 accountId) external view returns (int);
}
