//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Account.sol"

/**
 * @title Data for a single perps market
 */
library Account {

    struct Data {
        address owner;
        address nominatedOwner;
        uint128 id;
        bytes32 oracleNodeId;
        mapping (uint => Position) positions;
    }

    function create(uint128 id) internal returns (Data storage market) {
        market = load(id);
        market.id = id;
    } 
}