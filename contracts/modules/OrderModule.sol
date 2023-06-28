//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IOrderModule.sol";
import {Order} from "../storage/Order.sol";

contract OrderModule is IOrderModule {
    using Order for Order.Data;

    /**
     * Given the inputs necessary to create an order for commitment, perform validation and return an order upon success.
     */
    function validateOrderInput(
        int256 sizeDelta,
        uint256 desiredFillPrice,
        uint256 marketId
    ) internal returns (Order.Data memory order) {}

    function commitOrder(int sizeDelta, uint256 desiredFillPrice, uint256 marketId) external {}

    function settledOrder(address account) external {}

    function cancelOrder(address account) external {}
}
