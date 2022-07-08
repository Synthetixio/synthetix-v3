//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SharesLibrary {
    function sharesToAmount(
        uint totalShares,
        uint totalAmount,
        uint amount
    ) internal pure returns (uint) {
        return totalAmount == 0 ? amount : amount * (totalShares / totalAmount);
    }

    function amountToShares(
        uint totalShares,
        uint totalAmount,
        uint amount
    ) internal pure returns (uint) {
        return totalShares == 0 ? amount : (amount * totalShares) / totalAmount;
    }
}
