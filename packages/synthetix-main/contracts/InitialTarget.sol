//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";

// solhint-disable-next-line no-empty-blocks
contract InitialTarget is UUPSImplementation {

    address immutable deployer;

    constructor() {
        deployer = msg.sender;
    }

    function upgradeTo(address newImplementation) public override {
        require(msg.sender == deployer, "Not deployer");

        _upgradeTo(newImplementation);
    }
}
