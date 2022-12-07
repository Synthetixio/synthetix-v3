//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/IOwnerModule.sol";

/**
 * @title Module for giving a system owner based access control.
 * See IOwnerModule.
 */
contract OwnerModule is Ownable, IOwnerModule, InitializableMixin {
    /**
     * @inheritdoc IOwnerModule
     */
    function isOwnerModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    /**
     * @inheritdoc IOwnerModule
     */
    function initializeOwnerModule(address initialOwner) external override onlyIfNotInitialized {
        nominateNewOwner(initialOwner);
        acceptOwnership();

        OwnableStorage.load().initialized = true;
    }

    function _isInitialized() internal view override returns (bool) {
        return OwnableStorage.load().initialized;
    }
}
