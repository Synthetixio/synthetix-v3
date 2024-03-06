//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

interface ISettlementHook is IERC165 {
    /**
     * @notice Invoked as the callback post order settlement.
     *
     * @dev `onSettle` should verify the calling `msg.sender` is indeed the Synthetix BFP Market and
     * be highly recommended that it should also be idempotent.
     *
     * NOTE: `onSettle` is invoked _after_ a position is updated but _before_ the settled order has been deleted. This
     * means you can call `getOrderDigest` to retrieve the order for additional information.
     */
    function onSettle(uint128 accountId, uint128 marketId, int128 sizeDelta, int128 size, uint256 fillPrice) external;
}
