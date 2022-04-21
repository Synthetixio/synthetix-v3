//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/IFundModule.sol";
import "../storage/FundModuleStorage.sol";

contract FundModule is IFundModule, OwnableMixin, FundModuleStorage, InitializableMixin {
    event FundCreated(address fundAddress);

    function _isInitialized() internal view override returns (bool) {
        return _fundModuleStore().initialized;
    }

    function isFundModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeFundModule() external override onlyOwner onlyIfNotInitialized {
        FundModuleStore storage store = _fundModuleStore();

        store.initialized = true;
    }
}
