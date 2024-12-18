//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library Flags {
    string public constant WRAPPER_ENABLED = "wrapperEnabled";
    string public constant ATOMIC_ORDERS_ENABLED = "atomicOrdersEnabled";
    bytes32 public constant SPOT_MARKET_ENABLED = "spotMarketEnabled";
}
