//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/proxy/UpgradeableProxy.sol";

contract Synthetix is UpgradeableProxy {
    // solhint-disable-next-line no-empty-blocks
    constructor(address firstImplementation) UpgradeableProxy(firstImplementation, bytes("")) {}
}
