// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import "../../storage/SpotMarketFactory.sol";

interface ICustomFeeCalculator is IERC165 {
    function calculateFees(
        uint128 marketId,
        SpotMarketFactory.TransactionType transactionType,
        uint256 usdAmount,
        uint256 transactor
    ) external returns (uint256 amountUsable, uint256 feesCollected);
}
