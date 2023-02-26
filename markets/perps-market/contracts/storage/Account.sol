//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/**
 * @title Data for a single perps market
 */
library Account {
    struct Data {
        mapping (uint => SetUtil.AddressSet) depositedCollaterals;
        mapping (uint => SetUtil.UintSet) positions;
    }

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));

        assembly {
            account.slot := s
        }
    }
}