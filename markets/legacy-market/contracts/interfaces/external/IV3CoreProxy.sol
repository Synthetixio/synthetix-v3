//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IV3CoreProxy {
    function registerMarket(address market) external returns (uint128);

    function withdrawMarketUsd(uint128 marketId, address target, uint256 amount) external;

    function createAccount(uint128 requestedAccountId) external;

    function deposit(uint128 accountId, address collateralType, uint256 tokenAmount) external;

    function delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 amount,
        uint256 leverage
    ) external;

    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint256 amount
    ) external returns (int256);

    function getAccountTokenAddress() external view returns (address);

    function getPreferredPool() external returns (uint128);

    function createLock(
        uint128 accountId,
        address collateralType,
        uint256 amount,
        uint64 expireTimestamp
    ) external;
}
