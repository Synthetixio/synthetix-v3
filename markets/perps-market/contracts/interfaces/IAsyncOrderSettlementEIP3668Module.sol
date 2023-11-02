//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IAsyncOrderSettlementEIP3668Module {
    /**
     * @notice Settles an offchain order. It's expected to revert with the OffchainLookup error with the data needed to perform the offchain lookup.
     * @param accountId Id of the account used for the trade.
     */
    function settle(uint128 accountId) external view;
}
