//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/IAccountModule.sol";
import "../submodules/account/AccountBase.sol";
import "../token/Account.sol";

contract AccountModule is IAccountModule, OwnableMixin, AccountBase, SatelliteFactory {
    event AccountCreated(address accountAddress);

    function isAccountModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeAccountModule() external override onlyOwner onlyIfNotInitialized {
        AccountStore storage store = _accountStore();

        Account firstAccountImplementation = new Account();

        UUPSProxy accountProxy = new UUPSProxy(address(firstAccountImplementation));

        address accountProxyAddress = address(accountProxy);
        Account account = Account(accountProxyAddress);

        account.nominateNewOwner(address(this));
        account.acceptOwnership();
        account.initialize("Synthetix Network Account", "snxAccount", "");

        store.account = Satellite({name: "account", contractName: "Account", deployedAddress: accountProxyAddress});

        store.initialized = true;

        emit AccountCreated(accountProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _accountStore().snxToken;
        return satellites;
    }

    function getAccountModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }
}
