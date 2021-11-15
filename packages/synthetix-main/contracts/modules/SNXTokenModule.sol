//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../storage/SNXTokenStorage.sol";
import "../token/SNXToken.sol";

contract SNXTokenModule is OwnableMixin, SNXTokenStorage {
    error SNXAlreadyCreated();

    event SNXTokenCreated(address snxAddress);

    function createSNX() public onlyOwner {
        SNXTokenStore storage store = _snxTokenStore();

        if (store.snxTokenAddress != address(0)) {
            revert SNXAlreadyCreated();
        }

        SNXToken firstSNXTokenImplementation = new SNXToken();

        UUPSProxy snxTokenProxy = new UUPSProxy(address(firstSNXTokenImplementation));

        SNXToken(address(snxTokenProxy)).nominateNewOwner(address(this));
        SNXToken(address(snxTokenProxy)).acceptOwnership();

        SNXToken(address(snxTokenProxy)).initialize("Synthetix Network Token", "snx", 18);

        store.snxTokenAddress = address(snxTokenProxy);

        emit SNXTokenCreated(address(snxTokenProxy));
    }

    function upgradeSNXImplementation(address newSNXTokenImplementation) public onlyOwner {
        SNXToken(getSNXTokenAddress()).upgradeTo(newSNXTokenImplementation);
    }

    function getSNXTokenAddress() public view returns (address) {
        return _snxTokenStore().snxTokenAddress;
    }
}
