//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Account module
 */
interface IAccountModule {
    error InvalidAmountDelta(int amountDelta);

    event CollateralModified(
        uint128 indexed accountId,
        uint128 indexed synthMarketId,
        int indexed amountDelta,
        address sender
    );

    function modifyCollateral(uint128 accountId, uint128 synthMarketId, int amountDelta) external;

    function totalCollateralValue(uint128 accountId) external view returns (uint);

    function totalAccountOpenInterest(uint128 accountId) external view returns (uint);

    function openPosition(
        uint128 accountId,
        uint128 marketId
    ) external view returns (int, int, int);
}
