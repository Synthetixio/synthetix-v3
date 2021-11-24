//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../../storage/SampleStorage.sol";

contract SampleOwnedModule is SampleStorage, OwnableMixin {
    function setProtectedValue(uint newValue) public onlyOwner {
        _sampleStore().protectedValue = newValue;
    }

    function getProtectedValue() public view returns (uint) {
        return _sampleStore().protectedValue;
    }
}
