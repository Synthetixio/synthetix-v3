//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Account.sol";
import "./Position.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

/**
 * @title Data for a single perps market
 */
library PerpsMarket {

    error MarketNotRegistered(uint128 id);

    struct Data {
        address owner;
        address nominatedOwner;
        string name;
        string symbol;
        uint128 id;
        bytes32 oracleNodeId;
        mapping (uint => Position.Data) positions;
    }

    function create(uint128 id) internal returns (Data storage market) {
        market = load(id);
        market.id = id;
    }

    function load(uint128 id) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarket", id));

        assembly {
            market.slot := s
        }
    }

    function loadExisting(uint128 id) internal view returns (Data storage market) {
        market = load(id);

        if (market.id != id) {
            revert MarketNotRegistered(id);
        }
    }

    function loadWithVerifiedOwner(uint128 id, address possibleOwner) internal view returns (Data storage market) {
        market = load(id);

        if (market.owner != possibleOwner) {
            revert AccessError.Unauthorized(possibleOwner);
        }
    }

    function adjustPosition(Data storage self, uint128 accountId, Position.Data memory position) internal {
        // set mapping
        self.positions[accountId] = position;

        // update account
        //Account.load(accountId).perpsMarkets.add(self.id);
    }   
}