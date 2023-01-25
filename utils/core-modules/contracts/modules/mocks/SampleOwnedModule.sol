//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../../storage/SampleStorage.sol";
import "../../interfaces/ISampleOwnedModule.sol";

contract SampleOwnedModule is ISampleOwnedModule {
    function setProtectedValue(uint newProtectedValue) public payable override {
        OwnableStorage.onlyOwner();

        SampleStorage.load().protectedValue = newProtectedValue;
    }

    function getProtectedValue() public view override returns (uint) {
        return SampleStorage.load().protectedValue;
    }
}
