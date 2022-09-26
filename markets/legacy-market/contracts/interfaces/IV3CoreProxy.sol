//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IV3CoreProxy {
    function registerMarket(address marketAddress) external returns (uint128);

    function withdrawUSD(uint128 marketId, address to, uint amount) external;

    function createAccount(uint128 accountId) external;

    function depositCollateral(
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
            uint128 accountId,
            uint128 preferredPoolId,
            address oldSynthetix,
            uint debtAmount
    ) external;

    function getAccountTokenAddress() external returns (address);

    function getPreferredPool() external returns (uint128);
}