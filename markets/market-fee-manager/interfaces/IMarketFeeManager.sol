//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface a market's fee manager needs to adhere to.
interface IMarketFeeManager {
    function processFees(
        address transactor,
        uint marketId,
        uint amount,
        address synthetix
    )
        external
        returns (
            uint amountUsable, // $80
            uint amountBurned, // $100 -> $10 burned -> $10 fees sent to rewards distributor
            uint feesCollected // $20
        );
}
