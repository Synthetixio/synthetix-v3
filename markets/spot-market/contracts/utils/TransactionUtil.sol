//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library Transaction {
    error InvalidAsyncTransactionType(Type transactionType);

    enum Type {
        BUY_EXACT_IN,
        BUY_EXACT_OUT,
        SELL_EXACT_IN,
        SELL_EXACT_OUT,
        ASYNC_BUY,
        ASYNC_SELL,
        WRAP,
        UNWRAP
    }

    function isAsyncTransaction(Type orderType) internal pure {
        if (orderType != Type.ASYNC_BUY && orderType != Type.ASYNC_SELL) {
            revert InvalidAsyncTransactionType(orderType);
        }
    }

    function isBuy(Type orderType) internal pure returns (bool) {
        return
            orderType == Type.BUY_EXACT_IN ||
            orderType == Type.BUY_EXACT_OUT ||
            orderType == Type.ASYNC_BUY;
    }

    function isSell(Type orderType) internal pure returns (bool) {
        return
            orderType == Type.SELL_EXACT_IN ||
            orderType == Type.SELL_EXACT_OUT ||
            orderType == Type.ASYNC_SELL;
    }

    function isWrapper(Type orderType) internal pure returns (bool) {
        return orderType == Type.WRAP || orderType == Type.UNWRAP;
    }

    function isAsync(Type orderType) internal pure returns (bool) {
        return orderType == Type.ASYNC_BUY || orderType == Type.ASYNC_SELL;
    }

    function isExactOut(Type orderType) internal pure returns (bool) {
        return orderType == Type.BUY_EXACT_OUT || orderType == Type.SELL_EXACT_OUT;
    }

    function isExactIn(Type orderType) internal pure returns (bool) {
        return orderType == Type.BUY_EXACT_IN || orderType == Type.SELL_EXACT_IN;
    }
}
