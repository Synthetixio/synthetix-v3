//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../storage/InitializableStorage.sol";

contract InitializableModule is InitializableStorage, InitializableMixin {
    function _isInitialized() internal view override returns (bool) {
        return _initializableStore().initialized;
    }

    function isAnotherNameModuleInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initializeAnotherNameModule() external onlyIfNotInitialized {
        _initializableStore().initialized = true;
    }
}
