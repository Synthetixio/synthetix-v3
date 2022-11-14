//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IV3CoreProxy {
    function registerMarket(address marketAddress) external returns (uint128);

    function withdrawMarketUsd(
        uint marketId,
        address target,
        uint amount
    ) external;

    function createAccount(uint256 requestedAccountId) external;

    function deposit(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    function delegateCollateral(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount,
        uint leverage
    ) external;

    function associateDebt(
        uint marketId,
        uint poolId,
        address collateralType,
        uint accountId,
        uint amount
    ) external returns (int);

    function getAccountTokenAddress() external returns (address);

    function getPreferredPool() external returns (uint128);

    function createLock(
        uint accountId,
        address collateralType,
        uint amount,
        uint64 expireTimestamp
    ) external;
}
