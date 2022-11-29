//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Market.sol";

/**
 * @title TODO
 */
library MarketCreator {
    struct Data {
        mapping(address => uint[]) marketIdsForAddress;
        uint lastCreatedMarketId;
    }

    function _loadMarketStore() private pure returns (Data storage data) {
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
        uint128 id = _loadLastId();

        id++;

        market = Market.load(id);

        market.id = id;
        market.marketAddress = marketAddress;

        // set indexes
        _storeLastId(id);
        loadIdsByAddress(marketAddress).push(id);
    }

    /**
     * @dev Returns an array of market ids representing the markets linked to the system at a particular external contract address.
     *
     * Note: A contract implementing the `IMarket` interface may represent more than just one market, and thus several market ids could be associated to a single external contract address.
     */
    function loadIdsByAddress(address marketAddress) internal pure returns (uint[] storage ids) {
        return _loadMarketStore().marketIdsForAddress[marketAddress];
    }

    /**
     * @dev Retrieves the id of the last market created.
     *
     * TODO: Use constants for storage slots, here and possible everywhere in the code.
     */
    function _loadLastId() private view returns (uint128 data) {
        return _loadMarketStore().lastCreatedMarketId;
    }

    /**
     * @dev Caches the id of the last market that was created.
     *
     * Used to automatically generate a new id when a market is created.
     *
     * TODO: Use constants for storage slots, here and possible everywhere in the code.
     */
    function _storeLastId(uint128 newValue) private {
        _loadMarketStore().lastCreatedMarketId = newValue;
    }
}
