//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/IAccountModule.sol";
import "../storage/AccountModuleStorage.sol";

import "../satellites/AccountToken.sol";

contract AccountModule is IAccountModule, OwnableMixin, AccountModuleStorage, InitializableMixin, SatelliteFactory {
    event AccountCreated(address accountAddress);

    function _isInitialized() internal view override returns (bool) {
        return _accountModuleStore().initialized;
    }

    function isAccountModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeAccountModule() external override onlyOwner onlyIfNotInitialized {
        AccountModuleStore storage store = _accountModuleStore();

        AccountToken firstAccountImplementation = new AccountToken();

        UUPSProxy accountProxy = new UUPSProxy(address(firstAccountImplementation));

        address accountProxyAddress = address(accountProxy);
        AccountToken account = AccountToken(accountProxyAddress);

        account.nominateNewOwner(address(this));
        account.acceptOwnership();
        account.initialize("Synthetix Account", "synthethixAccount", "");

        store.account = Satellite({
            name: "synthethixAccount",
            contractName: "Account",
            deployedAddress: accountProxyAddress
        });

        store.initialized = true;

        emit AccountCreated(accountProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _accountModuleStore().account;
        return satellites;
    }

    function getAccountModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeAccountImplementation(address newAccountTokenImplementation)
        external
        override
        onlyOwner
        onlyIfInitialized
    {
        AccountToken(getAccountAddress()).upgradeTo(newAccountTokenImplementation);
    }

    function getAccountAddress() public view override returns (address) {
        return _accountModuleStore().account.deployedAddress;
    }
}
