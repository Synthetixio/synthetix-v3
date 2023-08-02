//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

interface IFeeCollector is IERC165 {
    /**
     * @notice  .This function is called by the spot market proxy to get the fee amount to be collected.
     * @dev     .The quoted fee amount is then transferred directly to the fee collector.
     * @param   marketId  .synth market id value
     * @param   feeAmount  .max fee amount that can be collected
     * @param   transactor  .the trader the fee was collected from
     * @return  feeAmountToCollect  .quoted fee amount
     */
    function quoteFees(
        uint128 marketId,
        uint256 feeAmount,
        address transactor
    ) external returns (uint256 feeAmountToCollect);
}
