//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

interface ISettlementHook is IERC165 {
    /// @notice Invoked as the callback post order settlement.
    /// @param accountId Account of order that was just settled
    /// @param marketId Market the order was just settled on
    /// @param oraclePrice Pyth price used for settlement (note: not the entry fill price)
    /// @dev Implementers should verify the calling `msg.sender` is Synthetix BFP Market Proxy and
    ///      be highly recommended that it should also be idempotent.
    function onSettle(uint128 accountId, uint128 marketId, uint256 oraclePrice) external;
}
