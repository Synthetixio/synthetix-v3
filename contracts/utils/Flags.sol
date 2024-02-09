//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library Flags {
    // @dev This flag needs to match the create account in `core-modules/contracts/storage/FeatureFlag.sol`.
    bytes32 public constant CREATE_ACCOUNT = "createAccount";
    bytes32 public constant DEPOSIT = "deposit";
    bytes32 public constant WITHDRAW = "withdraw";
    bytes32 public constant COMMIT_ORDER = "commitOrder";
    bytes32 public constant SETTLE_ORDER = "settleOrder";
    bytes32 public constant CANCEL_ORDER = "cancelOrder";
    bytes32 public constant FLAG_POSITION = "flagPosition";
    bytes32 public constant LIQUIDATE_POSITION = "liquidatePosition";
    bytes32 public constant PAY_DEBT = "payDebt";
    bytes32 public constant LIQUIDATE_MARGIN = "liquidateMargin";
}
