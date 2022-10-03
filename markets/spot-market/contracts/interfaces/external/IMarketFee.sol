//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface a market's fee manager needs to adhere to.
interface IMarketFee {
    function processFees(
        address transactor,
        uint marketId,
        uint amount
    ) external returns (uint amountUsable, uint feesCollected);
}
