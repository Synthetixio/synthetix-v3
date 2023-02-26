//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Account.sol";

/**
 * @title Data for a single perps market
 */
library PerpsMarket {
    struct Data {
        address owner;
        address nominatedOwner;
        uint128 id;
        int256 skew;
        uint256 size;
        mapping(uint => Position) positions;
    }

    function create(uint128 id) internal returns (Data storage market) {
        market = load(id);
        market.id = id;
    }

    function load(uint128 id) internal returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarket", id));

        assembly {
            market.slot := s
        }
    }

    function adjustPosition(
        Data storage self,
        uint128 accountId,
        Position memory position
    ) internal {
        // set mapping
        self.positions[account] = position;

        // update account
        Account.load(accountId).perpsMarkets.add(self.id);
    }
}
