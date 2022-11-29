//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TODO
 */
library MarketCreator {
    struct Data {
        uint[] marketIdsForAddress;
        uint lastCreatedMarketId;
    }

    function _loadMarketStore() private pure returns (Data storage data) {
        bytes32 s = keccak256("MarketStore");
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Returns an array of market ids representing the markets linked to the system at a particular external contract address.
     *
     * Note: A contract implementing the `IMarket` interface may represent more than just one market, and thus several market ids could be associated to a single external contract address.
     */
    function loadIdsByAddress(address addr) internal pure returns (uint[] storage ids) {
        return _loadMarketStore().marketIdsForAddress[addr];
    }

    /**
     * @dev Retrieves the id of the last market created.
     *
     * TODO: Use constants for storage slots, here and possible everywhere in the code.
     */
    function loadLastId() internal view returns (uint128 data) {
        return _loadMarketStore().lastCreatedMarketId;
    }

    /**
     * @dev Caches the id of the last market that was created.
     *
     * Used to automatically generate a new id when a market is created.
     *
     * TODO: Use constants for storage slots, here and possible everywhere in the code.
     */
    function storeLastId(uint128 newValue) internal {
        _loadMarketStore().lastCreatedMarketId = newValue;
    }

    /**
     * @dev Given an external contract address representing an `IMarket`, creates a new id for the market, and tracks it internally in the system.
     *
     * The id used to track the market will be automatically assigned by the system according to the last id used.
     *
     * Note: If an external `IMarket` contract tracks several market ids, this function should be called for each market it tracks, resulting in multiple ids for the same address.
     */
    function create(address market) internal returns (Market.Data storage self) {
        uint128 id = loadLastId();

        id++;

        self = load(id);

        self.id = id;
        self.marketAddress = market;

        // set indexes
        storeLastId(id);
        loadIdsByAddress(market).push(id);
    }
}
