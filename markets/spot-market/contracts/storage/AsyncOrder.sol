//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AsyncOrder {
    struct Data {
        mapping(uint => AsyncOrderClaim) asyncOrderClaims;
        uint minimumOrderAge;
        uint externalCancellationBufferTime;
    }

    struct AsyncOrderClaim {
        uint orderType; //change this?
        uint amountProvided; // maybe this is traderAmountEscrowed
        uint amountStaged; // maybe this is systemAmountEscrowed
        uint feesQuoted;
        uint blockNumber;
        uint timestamp;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrder", marketId));
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        uint asyncOrderId,
        AsyncOrderData memory asyncOrderData
    ) internal {
        update(load(marketId), asyncOrderId, asyncOrderData);
    }

    function update(
        Data storage self,
        uint asyncOrderId,
        AsyncOrderData memory asyncOrderData
    ) internal {
        self.asyncOrders[asyncOrderId] = asyncOrderData;
    }
}
