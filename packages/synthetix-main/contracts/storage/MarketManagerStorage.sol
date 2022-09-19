//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";

contract MarketManagerStorage {
    struct MarketManagerStore {
        mapping(uint => MarketData) markets;
        mapping(address => uint) marketIds;
        uint lastMarketId;
    }

    struct MarketData {
        /// @notice the address which is used by the market to communicate with the core system. Implements `IMarket` interface
        address marketAddress;
        /// @notice the difference between the USD burnt by the market, and the amount minted
        int128 issuance;
        /// @notice the total amount of USD that the market could withdraw right now
        uint128 capacity;
        /// @notice the amount of debt the last time the debt was distributed
        int128 lastMarketBalance;
        // used to disconnect pools from a market if it goes above a certain debt per debt share
        HeapUtil.Data inRangePools;
        // used to attach/reattach pools to a market if it goes below a certain debt per debt share
        HeapUtil.Data outRangePools;
        SharesLibrary.Distribution debtDist;
        // @notice the amount of a given collateral type deposited by this market
        mapping(address => uint128) depositedCollateral;
    }

    function _marketManagerStore() internal pure returns (MarketManagerStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.marketmanager")) - 1)
            store.slot := 0x38077fe0897d5edca02a59b2d0aa55ba8c04cdd9bb648f71ac154665d97109cd
        }
    }
}
