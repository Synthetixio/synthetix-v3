//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./AsyncAccountOrder.sol";
import "./SettlementStrategy.sol";

library AsyncOrder {
    struct Data {
        mapping(bytes32 => AsyncAccountOrder.Data) orders;
    }

    function load(uint128 marketId, uint256 accountId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.AsyncOrder", marketId, accountId)
        );
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        uint256 accountId,
        int256 sizeDelta,
        uint256 settlementStrategyId,
        uint256 acceptablePrice,
        bytes32 trackingCode
    ) internal returns (AsyncAccountOrder.Data storage order) {
        SettlementStrategy.Data storage settlementStrategy = SettlementStrategy.load(
            marketId,
            settlementStrategyId
        );

        Data storage store = load(marketId, accountId);
        bytes32 orderId = keccak256(abi.encodePacked(marketId, accountId));
        AsyncAccountOrder.Data memory accountOrder = AsyncAccountOrder.Data({
            sizeDelta: sizeDelta,
            settlementStrategy: settlementStrategy,
            acceptablePrice: acceptablePrice,
            trackingCode: trackingCode
        });
        store.orders[orderId] = accountOrder;

        return accountOrder;
    }
}
