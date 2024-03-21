//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

interface ISettlementHook is IERC165 {
    /**
     * @notice Invoked as the callback post order settlement.
     *
     * @dev `onSettle` should verify the calling `msg.sender` is indeed the Synthetix BFP Market and
     * be highly recommended that it should also be idempotent.
     */
    function onSettle(uint128 accountId, uint128 marketId, uint256 oraclePrice) external;
}
