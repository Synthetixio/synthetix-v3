//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/ISpotMarket.sol";

contract WrapperStorage {
    struct WrapperStore {
        address collateralType;
        bool wrappingEnabled;
    }

    function _wrapperStore() internal pure returns (WrapperStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.spotMarket")) - 1)
            store.slot := 0xd5a9a8f1c2c3f6461a3504b3d4bd3b22e0a29aad9475751bf4e32148a50b8fa7
        }
    }
}
