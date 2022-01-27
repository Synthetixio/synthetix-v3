//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../../storage/SampleStorage.sol";
import "../../interfaces/ISampleOwnedModule.sol";

contract SampleOwnedModule is SampleStorage, OwnableMixin, ISampleOwnedModule {
    function setProtectedValue(uint newProtectedValue) public override onlyOwner {
        _sampleStore().protectedValue = newProtectedValue;
    }

    function getProtectedValue() public view override returns (uint) {
        return _sampleStore().protectedValue;
    }
}
