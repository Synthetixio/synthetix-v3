//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAsyncOrderViewModule} from "../interfaces/IAsyncOrderViewModule.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";

contract AsyncOrderViewModule is IAsyncOrderViewModule {
    using PerpsMarket for PerpsMarket.Data;

    function getOrder(
        uint128 marketId,
        uint128 accountId
    ) public view override returns (AsyncOrder.Data memory) {
        return PerpsMarket.loadValid(marketId).asyncOrders[accountId];
    }
}
