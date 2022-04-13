//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/IAccountModule.sol";
import "../submodules/account/AccountBase.sol";

contract AccountModule is IAccountModule, OwnableMixin, AccountBase, SatelliteFactory {
    event AccountCreated(address accountAddress);

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

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        return satellites;
    }

    function getAccountModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }
}
