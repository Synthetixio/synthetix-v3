//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Transaction types supported by the spot market system
 */
library Transaction {
    error InvalidAsyncTransactionType(Type transactionType);
    error InvalidTransactionTypeIndex(uint128 txnType);

    enum Type {
        NULL, // reserved for 0 (default value)
        BUY,
        SELL,
        ASYNC_BUY,
        ASYNC_SELL,
        WRAP,
        UNWRAP
    }

    function loadValidTransactionType(uint128 txnType) internal pure returns (Type) {
        // solhint-disable-next-line numcast/safe-cast
        uint128 txnTypeMax = uint128(Type.UNWRAP);
        if (txnType > txnTypeMax) {
            revert InvalidTransactionTypeIndex(txnType);
        }

        return Type(txnType);
    }

    function validateAsyncTransaction(Type orderType) internal pure {
        if (orderType != Type.ASYNC_BUY && orderType != Type.ASYNC_SELL) {
            revert InvalidAsyncTransactionType(orderType);
        }
    }

    function isBuy(Type orderType) internal pure returns (bool) {
        return orderType == Type.BUY || orderType == Type.ASYNC_BUY;
    }

    function isSell(Type orderType) internal pure returns (bool) {
        return orderType == Type.SELL || orderType == Type.ASYNC_SELL;
    }

    function isWrapper(Type orderType) internal pure returns (bool) {
        return orderType == Type.WRAP || orderType == Type.UNWRAP;
    }

    function isAsync(Type orderType) internal pure returns (bool) {
        return orderType == Type.ASYNC_BUY || orderType == Type.ASYNC_SELL;
    }
}
