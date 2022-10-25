//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/ISpotMarket.sol";

contract Wrapper {
    struct Data {
        address collateralType;
        bool wrappingEnabled;
    }

    function _wrapperStore() internal pure returns (WrapperStore storage store) {
        bytes32 s = keccak256(abi.encode("SpotMarket.Wrapper"));
        assembly {
            store.slot := s
        }
    }
}
