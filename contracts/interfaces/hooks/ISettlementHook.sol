//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

interface ISettlementHook is IERC165 {
    function onSettle() external;
}
