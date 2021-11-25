//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../../storage/SampleStorage.sol";

contract SampleOwnedModule is SampleStorage, OwnableMixin {
    function setProtectedValue(uint newProtectedValue) public onlyOwner {
        _sampleStore().protectedValue = newProtectedValue;
    }

    function getProtectedValue() public view returns (uint) {
        return _sampleStore().protectedValue;
    }
}
