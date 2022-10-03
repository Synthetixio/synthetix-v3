//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/ISpotMarket.sol";

contract SpotMarketStorage {
    struct SpotMarketStore {
        ITokenModule usdToken;
        address synthetix;
        address marketOwner;
    }

    mapping(uint => MarketSynth) public marketSynths;

    function _globalStore() internal pure returns (SpotMarketStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.spotMarket")) - 1)
            store.slot := 0x84549f03cbcfd16a17f4ed251daa66072cc5694fe185dfd6d5d76bf13e0b2ea4
        }
    }
}
