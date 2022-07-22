//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "../storage/USDTokenStorage.sol";
import "../interfaces/IUSDToken.sol";

contract USDMixin is USDTokenStorage {
    function _getUSDTokenAddress() internal view returns (address) {
        return _USDTokenStore().usdToken.deployedAddress;
    }

    function _getUSDToken() internal view returns (IUSDToken) {
        return IUSDToken(_USDTokenStore().usdToken.deployedAddress);
    }

    function _usdTokenInitialized() internal view returns (bool) {
        return _USDTokenStore().initialized;
    }

    modifier onlyIfUSDIsInitialized() {
        if (!_usdTokenInitialized()) {
            revert InitError.NotInitialized();
        }

        _;
    }
}
