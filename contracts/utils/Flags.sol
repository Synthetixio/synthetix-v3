//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library Flags {
    bytes32 public constant CREATE_ACCOUNT = "createAccount"; // Note this flag needs to match the create account in core-modules/contracts/storage/FeatureFlag.sol
    bytes32 public constant DEPOSIT = "deposit";
    bytes32 public constant WITHDRAW = "withdraw";
    bytes32 public constant COMMIT_ORDER = "commitOrder";
    bytes32 public constant SETTLE_ORDER = "settleOrder";
    bytes32 public constant CANCEL_ORDER = "cancelOrder";
    bytes32 public constant FLAG_POSITION = "flagPosition";
    bytes32 public constant LIQUIDATE_POSITION = "liquidatePosition";
}
