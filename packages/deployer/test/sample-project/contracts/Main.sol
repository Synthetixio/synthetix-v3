//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./libraries/UpgradeableProxy.sol";

contract Main is UpgradeableProxy {
    constructor(address firstImplementation) UpgradeableProxy(firstImplementation, bytes("")) {}
}
