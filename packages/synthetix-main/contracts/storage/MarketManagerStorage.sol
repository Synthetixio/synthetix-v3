//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../utils/Heap.sol";

contract MarketManagerStorage {
    struct MarketManagerStore {
        mapping(uint => MarketData) markets;
        mapping(address => uint) marketIds;
        uint lastMarketId;
    }

    struct MarketData {
        // used to stop the market from minting more sUSD without checking each fund individually
        int128 issuance;
        int128 lastMarketBalance;
        int128 maxMarketDebt;
        address marketAddress;
        // used to disconnect funds from a market if it goes above a certain debt per debt share
        Heap.Data fundMaxDebtShares;
        SharesLibrary.Distribution debtDist;
    }

    function _marketManagerStore() internal pure returns (MarketManagerStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.marketmanager")) - 1)
            store.slot := 0x38077fe0897d5edca02a59b2d0aa55ba8c04cdd9bb648f71ac154665d97109cd
        }
    }
}
