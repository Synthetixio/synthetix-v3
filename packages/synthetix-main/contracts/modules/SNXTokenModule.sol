//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/mixins/OwnerMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UnstructuredProxy.sol";

import "../storage/SNXModuleStorage.sol";
import "../core/SNXTokenImplementation.sol";

contract SNXTokenModule is OwnerMixin, SNXModuleStorage {
    error SNXAlreadyCreated();

    event SNXCreated(address snxAddress);

    function createSNXProxy(        
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public onlyOwner {
        if (_snxStorage().snxAddress != address(0x0)) {
            revert SNXAlreadyCreated();
        }

        SNXTokenImplementation snxInstance = new SNXTokenImplementation(tokenName, tokenSymbol, tokenDecimals);

        UnstructuredProxy snxProxy = new UnstructuredProxy(address(snxInstance));

        _snxStorage().snxAddress = address(snxProxy);

        emit SNXCreated(address(snxProxy));
    }

    function setSNXImplementation(address newSNXImplementation) public onlyOwner {
        SNXTokenImplementation(getSNXAddress()).upgradeTo(newSNXImplementation);
    }

    function getSNXAddress() public view returns (address) {
        return _snxStorage().snxAddress;
    }
}
