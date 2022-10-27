//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/SpotMarketStorage.sol";

contract SpotMarketMixin is SpotMarketStorage {
    error InsufficientFunds();
    error InsufficientAllowance(uint expected, uint current);
}
