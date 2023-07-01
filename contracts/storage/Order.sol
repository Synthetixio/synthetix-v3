//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @dev An order that has yet to be settled for position modification.
 */
library Order {
    struct Data {
        uint128 accountId;
        int128 sizeDelta;
        uint256 commitmentTime;
        uint256 desiredFillPrice;
    }
}
