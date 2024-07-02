//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {WormholeMock as WormholeMockBase} from "@synthetixio/core-modules/contracts/mocks/WormholeMock.sol";

// solhint-disable-next-line no-empty-blocks
contract WormholeMock is WormholeMockBase {
    constructor(uint256 chainId) WormholeMockBase(chainId) {}
}
