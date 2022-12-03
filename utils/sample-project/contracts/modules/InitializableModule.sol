//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../storage/InitializableStorage.sol";
import "../interfaces/IInitializableModule.sol";

contract InitializableModule is InitializableStorage, InitializableMixin, IInitializableModule {
    function _isInitialized() internal view override returns (bool) {
        return _initializableStore().initialized;
    }

    function isInitializableModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeInitializableModule() external override onlyIfNotInitialized {
        _initializableStore().initialized = true;
    }
}
