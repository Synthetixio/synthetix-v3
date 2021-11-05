//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/SNXModuleStorage.sol";
import "../core/SNXProxy.sol";
import "../core/SNXImplementation.sol";

contract SNXModule is OwnableMixin, SNXModuleStorage {
    error SNXAlreadyCreated();

    event SNXCreated(address snxAddress);

    function createSNX() public onlyOwner {
        if (_snxStorage().snxAddress != address(0x0)) {
            revert SNXAlreadyCreated();
        }

        // Create the first implementation
        SNXImplementation snxInstance = new SNXImplementation();

        // Create the SNX proxy and point it to the first implementation (Forwarding Proxy or Beacon?)
        SNXProxy snxProxy = new SNXProxy(address(snxInstance));

        // Fix the module (system) as the owner and use the system government to control updateSNXImplementation
        SNXImplementation(address(snxProxy)).initialize(address(this));
        // TODO Add some SNX Initialization data to createSNX function
        //      and relay it to this initializer (or to the constructor)

        // store the new SNX proxy address (or remove if using the vanity address)
        _snxStorage().snxAddress = address(snxProxy);

        emit SNXCreated(address(snxProxy));
    }

    function upgradeSNXImplementation(address newSNXImplementation) public onlyOwner {
        SNXImplementation(getSNXAddress()).upgradeTo(newSNXImplementation);
    }

    function getSNXAddress() public view returns (address) {
        return _snxStorage().snxAddress;
    }
}
