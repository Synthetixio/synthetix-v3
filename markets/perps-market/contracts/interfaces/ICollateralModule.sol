//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ICollateralModule {
    function modifyCollateral(uint128 accountId, address collateralType, int amount) external;
}
