//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/ISpotMarket.sol";

contract SpotMarket {
    struct Data {
        bytes buyFeedId;
        bytes sellFeedId;
        ITokenModule usdToken;
        address synthetix;
        address feeManager;
        uint128 marketId;
        bool initialized;
    }

    function _spotMarketStore() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("SpotMarket"));
        assembly {
            store.slot := s
        }
    }
}
