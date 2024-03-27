//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../ownership/Configurable.sol";
import "../../ownership/ConfigurableStorage.sol";
import "../../ownership/Ownable.sol";
import "../../ownership/OwnableStorage.sol";

/**
 * @title Mock Contract that has an owner and a configurer.
 */
contract ConfigurableMock is Ownable, Configurable {
    uint256 public counter;

    constructor(address owner_) Ownable(owner_) {}

    // for testing onlyOwnerOrConfigurer
    function countUp() external {
        ConfigurableStorage.onlyOwnerOrConfigurer();
        counter++;
    }

    // for testing that the configurer cannot call onlyOwner functions
    function setCounter(uint256 _counter) external {
        OwnableStorage.onlyOwner();
        counter = _counter;
    }
}
