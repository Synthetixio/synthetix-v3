//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/IOwnerModule.sol";

contract OwnerModule is Ownable, IOwnerModule, InitializableMixin {
    function _isInitialized() internal view override returns (bool) {
        return OwnableStorage.load().initialized;
    }

    function isOwnerModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeOwnerModule(address initialOwner) external override onlyIfNotInitialized {
        nominateNewOwner(initialOwner);
        acceptOwnership();

        OwnableStorage.load().initialized = true;
    }
}
