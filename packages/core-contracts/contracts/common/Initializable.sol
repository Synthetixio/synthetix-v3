//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./InitializableStorage.sol";

contract Initializable is InitializableStorage {
    error AlreadyInitialized();

    modifier initializer() {
        InitializableStore storage store = _initializableStore();
        if (!_initializableStore().initializing && _initializableStore().initialized) {
            revert AlreadyInitialized();
        }

        bool isTopLevelCall = !_initializableStore().initializing;
        if (isTopLevelCall) {
            _initializableStore().initializing = true;
            _initializableStore().initialized = true;
        }

        _;

        if (isTopLevelCall) {
            _initializableStore().initializing = false;
        }
    }
}
