//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/proxy/UpgradeableProxy.sol";


contract Main is UpgradeableProxy {
    constructor(address firstImplementation)
        UpgradeableProxy(
            firstImplementation,
            bytes("")
        )
    {}
}
