//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";

/**
 * @title Account module
 */
interface IAccountModule {
    /**
     * @notice Gets fired when an account colateral is modified.
     * @param accountId Id of the account.
     * @param synthMarketId Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
     * @param amountDelta requested change in amount of collateral delegated to the account.
     * @param sender address of the sender of the size modification. Authorized by account owner.
     */
    event CollateralModified(
        uint128 indexed accountId,
        uint128 indexed synthMarketId,
        int256 amountDelta,
        address indexed sender
    );

    /**
     * @notice Gets thrown when the amount delta is zero.
     */
    error InvalidAmountDelta(int amountDelta);

    /**
     * @notice Modify the collateral delegated to the account.
     * @param accountId Id of the account.
     * @param synthMarketId Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
     * @param amountDelta requested change in amount of collateral delegated to the account.
     */
    function modifyCollateral(uint128 accountId, uint128 synthMarketId, int amountDelta) external;

    /**
     * @notice Gets the account's collateral value for a specific collateral.
     * @param accountId Id of the account.
     * @param synthMarketId Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
     * @return collateralValue collateral value of the account.
     */
    function getCollateralAmount(
        uint128 accountId,
        uint128 synthMarketId
    ) external view returns (uint256);

    /**
     * @notice Gets the account's total collateral value.
     * @param accountId Id of the account.
     * @return collateralValue total collateral value of the account. USD denominated.
     */
    function totalCollateralValue(uint128 accountId) external view returns (uint);

    /**
     * @notice Gets the account's total open interest value.
     * @param accountId Id of the account.
     * @return openInterestValue total open interest value of the account.
     */
    function totalAccountOpenInterest(uint128 accountId) external view returns (uint);

    /**
     * @notice Gets the details of an open position.
     * @param accountId Id of the account.
     * @param marketId Id of the position market.
     * @return pnl pnl of the position.
     * @return accruedFunding accrued funding of the position.
     * @return size size of the position.
     */
    function getOpenPosition(
        uint128 accountId,
        uint128 marketId
    ) external view returns (int pnl, int accruedFunding, int size);

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

    /**
     * @notice Gets the available margin of an account. It can be negative due to pnl.
     * @param accountId Id of the account.
     * @return availableMargin available margin of the position.
     */
    function getAvailableMargin(uint128 accountId) external view returns (int);
}
