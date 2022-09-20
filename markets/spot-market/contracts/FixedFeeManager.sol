pragma solidity ^0.8.0;

import "@synthetixio/market-fee-manager/interfaces/IMarketFeeManager.sol";

/* 
    Fixed Fee mechanism for Spot Market
*/
contract FixedFeeManager is IMarketFeeManager {
    function processFees(
        uint transactor,
        uint marketId,
        uint amount
    )
        external
        override
        returns (
            uint amountUsable,
            uint amountBurned,
            uint feesCollected
        )
    {
        return (amount, 0, 0);
    }
}
