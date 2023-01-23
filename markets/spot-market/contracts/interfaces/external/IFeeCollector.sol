//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

/// @title Spot Market Interface
interface IFeeCollector is IERC165 {
    function collectFees(uint128 marketId, uint256 feeAmount) external;
}
