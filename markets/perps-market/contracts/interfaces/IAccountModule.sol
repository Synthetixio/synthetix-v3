//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";

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

    function getOpenPosition(
        uint128 accountId,
        uint128 marketId
    ) external view returns (int, int, int);

    /**
     * @notice Get async order claim details
     * @param accountId id of the account.
     * @param marketId Id of the market used for the trade.
     * @return asyncOrderClaim claim details (see AsyncOrder.Data struct).
     */
    function getAsyncOrderClaim(
        uint128 accountId,
        uint128 marketId
    ) external view returns (AsyncOrder.Data memory);

    function getAvailableMargin(uint128 accountId) external view returns (int);
}
