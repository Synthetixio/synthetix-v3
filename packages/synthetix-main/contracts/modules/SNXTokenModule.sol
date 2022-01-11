//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteManager.sol";
import "../interfaces/ISNXTokenModule.sol";
import "../storage/SNXTokenStorage.sol";
import "../token/SNXToken.sol";

contract SNXTokenModule is ISNXTokenModule, OwnableMixin, SNXTokenStorage, SatelliteManager {
    error SNXAlreadyCreated();

    function createSNX() external override onlyOwner {
        SNXTokenStore storage store = _snxTokenStore();

        if (store.snxTokenAddress != address(0)) {
            revert SNXAlreadyCreated();
        }

        SNXToken firstSNXTokenImplementation = new SNXToken();

        UUPSProxy snxTokenProxy = new UUPSProxy(address(firstSNXTokenImplementation));

        address snxTokenProxyAddress = address(snxTokenProxy);
        SNXToken snxToken = SNXToken(snxTokenProxyAddress);

        snxToken.nominateNewOwner(address(this));
        snxToken.acceptOwnership();
        snxToken.initialize("Synthetix Network Token", "snx", 18);

        store.snxTokenAddress = snxTokenProxyAddress;

        emit SatelliteCreated("contracts/token/SNXToken.sol:SNXToken", address(snxTokenProxyAddress));
    }

    function upgradeSNXImplementation(address newSNXTokenImplementation) external override onlyOwner {
        SNXToken(getSNXTokenAddress()).upgradeTo(newSNXTokenImplementation);
    }

    function getSNXTokenAddress() public view override returns (address) {
        return _snxTokenStore().snxTokenAddress;
    }
}
