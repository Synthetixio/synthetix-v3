//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "../storage/SUSDTokenStorage.sol";
import "../interfaces/ISUSDToken.sol";

contract SUSDMixin is SUSDTokenStorage {
    function _getSUSDTokenAddress() internal view returns (address) {
        return _sUSDTokenStore().sUSDToken.deployedAddress;
    }

    function _getSUSDToken() internal view returns (ISUSDToken) {
        return ISUSDToken(_sUSDTokenStore().sUSDToken.deployedAddress);
    }

    function _sUSDInitialized() internal view returns (bool) {
        return _sUSDTokenStore().initialized;
    }

    modifier onlyIfsUSDIsInitialized() {
        if (!_sUSDInitialized()) {
            revert InitError.NotInitialized();
        }

        _;
    }
}
