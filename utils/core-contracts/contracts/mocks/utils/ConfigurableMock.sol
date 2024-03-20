//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../ownership/Configurable.sol";
import "../../ownership/Ownable.sol";

/**
 * @title Mock Contract that has an owner and a configurer.
 */
contract ConfigurableMock is Ownable, Configurable {
    constructor(address owner_) Ownable(owner_) {}
}
