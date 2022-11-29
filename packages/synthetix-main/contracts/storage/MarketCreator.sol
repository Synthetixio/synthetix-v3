//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Market.sol";

/**
 * @title TODO
 *
 * TODO: Rename to MarketIndexes
 */
library MarketCreator {
    struct Data {
        mapping(address => uint128[]) marketIdsForAddress;
        uint128 lastCreatedMarketId;
    }

    function _getStore() private pure returns (Data storage data) {
        bytes32 s = keccak256("MarketStore");
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Given an external contract address representing an `IMarket`, creates a new id for the market, and tracks it internally in the system.
     *
     * The id used to track the market will be automatically assigned by the system according to the last id used.
     *
     * Note: If an external `IMarket` contract tracks several market ids, this function should be called for each market it tracks, resulting in multiple ids for the same address.
     */
    function create(address marketAddress) internal returns (Market.Data storage market) {
        Data storage store = _getStore();

        uint128 id = store.lastCreatedMarketId;
        id++;

        market = Market.load(id);

        market.id = id;
        market.marketAddress = marketAddress;

        store.lastCreatedMarketId = id;

        loadIdsByAddress(marketAddress).push(id);
    }

    /**
     * @dev Returns an array of market ids representing the markets linked to the system at a particular external contract address.
     *
     * Note: A contract implementing the `IMarket` interface may represent more than just one market, and thus several market ids could be associated to a single external contract address.
     */
    function loadIdsByAddress(address marketAddress) internal view returns (uint128[] storage ids) {
        return _getStore().marketIdsForAddress[marketAddress];
    }
}
