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
        if (_snxTokenStorage().snxTokenAddress != address(0)) {
            revert SNXAlreadyCreated();
        }

        SNXToken firstSNXTokenImplementation = new SNXToken();

        UUPSProxy snxTokenProxy = new UUPSProxy(address(firstSNXTokenImplementation));

        SNXToken(address(snxTokenProxy)).nominateNewOwner(address(this));
        SNXToken(address(snxTokenProxy)).acceptOwnership();

        _snxTokenStorage().snxTokenAddress = address(snxTokenProxy);

        emit SNXTokenCreated(address(snxTokenProxy));
    }

    function upgradeSNXImplementation(address newSNXTokenImplementation) public onlyOwner {
        SNXToken(getSNXTokenAddress()).upgradeTo(newSNXTokenImplementation);
    }

    function getSNXTokenAddress() public view returns (address) {
        return _snxTokenStorage().snxTokenAddress;
    }
}
