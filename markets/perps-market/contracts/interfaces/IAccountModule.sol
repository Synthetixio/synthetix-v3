//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Account module
 */
interface IAccountModule {
    // function collaterals( uint128 accountId) external view returns (Collateral[] memory); 
    function totalCollateralValue (uint128 accountId) external view returns (uint);

}
