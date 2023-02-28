//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AccountCollateral {
    struct Data {
        mapping(address => int) collateralAmounts;
    }
}
