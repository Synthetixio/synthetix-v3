//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";


contract Greeter {
  string greeting;

  function greet() public view returns (string memory) {
    return greeting;
  }

  function setGreeting(string memory _greeting) public {
    console.log("Changing greeting from '%s' to '%s'", greeting, _greeting);
    greeting = _greeting;
  }
}
