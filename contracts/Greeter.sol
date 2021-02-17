//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";


contract Greeter {
  string private _greeting;

  constructor(string memory greeting) {
    console.log("Deploying a Greeter with greeting:", greeting);
    _greeting = greeting;
  }

  function greet() public view returns (string memory) {
    return _greeting;
  }

  function setGreeting(string memory greeting) public {
    console.log("Changing greeting from '%s' to '%s'", _greeting, greeting);
    _greeting = greeting;
  }
}
