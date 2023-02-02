//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Market.sol";

/**
 * @title Encapsulates market creation logic
 */
library MarketCreator {
    bytes32 private constant _SLOT_MARKET_CREATOR =
        keccak256(abi.encode("io.synthetix.synthetix.Markets"));

    struct Data {
        /**
         * @dev Tracks an array of market ids for each external IMarket address.
         */
        mapping(address => uint128[]) marketIdsForAddress;
        /**
         * @dev Keeps track of the last market id created.
         * Used for easily creating new markets.
         */
        uint128 lastCreatedMarketId;
    }

    /**
     * @dev Returns the singleton market store of the system.
     */
    function getMarketStore() internal pure returns (Data storage marketStore) {
        bytes32 s = _SLOT_MARKET_CREATOR;
        assembly {
            marketStore.slot := s
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
        Data storage marketStore = getMarketStore();

        uint128 id = marketStore.lastCreatedMarketId;
        id++;

        market = Market.load(id);

        market.id = id;
        market.marketAddress = marketAddress;

        marketStore.lastCreatedMarketId = id;

        loadIdsByAddress(marketAddress).push(id);
    }

    /**
     * @dev Returns an array of market ids representing the markets linked to the system at a particular external contract address.
     *
     * Note: A contract implementing the `IMarket` interface may represent more than just one market, and thus several market ids could be associated to a single external contract address.
     */
    function loadIdsByAddress(address marketAddress) internal view returns (uint128[] storage ids) {
        return getMarketStore().marketIdsForAddress[marketAddress];
    }
}
