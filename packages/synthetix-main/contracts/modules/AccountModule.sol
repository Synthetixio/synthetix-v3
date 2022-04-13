//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../interfaces/IAccountModule.sol";
import "../submodules/account/AccountBase.sol";

contract AccountModule is IAccountModule, AccountBase, OwnableMixin {
    function isAccountModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeAccountModule(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external override onlyOwner onlyIfNotInitialized {
        _initialize(tokenName, tokenSymbol, uri);

        AccountStore storage store = _accountStore();

        store.initialized = true;
    }
}
