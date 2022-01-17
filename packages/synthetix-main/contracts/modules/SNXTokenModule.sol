//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/ISNXTokenModule.sol";
import "../storage/SNXTokenStorage.sol";
import "../token/SNXToken.sol";

contract SNXTokenModule is ISNXTokenModule, OwnableMixin, SNXTokenStorage, InitializableMixin {
    event SNXTokenCreated(address snxAddress);

    function _isInitialized() internal view override returns (bool) {
        return _snxTokenStore().snxTokenAddress != address(0);
    }

    function isSNXTokenModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeSNXTokenModule() external override onlyOwner onlyIfNotInitialized {
        SNXTokenStore storage store = _snxTokenStore();

        SNXToken firstSNXTokenImplementation = new SNXToken();

        UUPSProxy snxTokenProxy = new UUPSProxy(address(firstSNXTokenImplementation));

        address snxTokenProxyAddress = address(snxTokenProxy);
        SNXToken snxToken = SNXToken(snxTokenProxyAddress);

        snxToken.nominateNewOwner(address(this));
        snxToken.acceptOwnership();
        snxToken.initialize("Synthetix Network Token", "snx", 18);

        store.snxTokenAddress = snxTokenProxyAddress;

        emit SNXTokenCreated(snxTokenProxyAddress);
    }

    function upgradeSNXImplementation(address newSNXTokenImplementation) external override onlyOwner onlyIfInitialized {
        SNXToken(getSNXTokenAddress()).upgradeTo(newSNXTokenImplementation);
    }

    function getSNXTokenAddress() public view override returns (address) {
        return _snxTokenStore().snxTokenAddress;
    }
}
