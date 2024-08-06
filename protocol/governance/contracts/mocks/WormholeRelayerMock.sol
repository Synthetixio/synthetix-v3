//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {WormholeRelayerMock as WormholeRelayerMockBase} from "@synthetixio/core-modules/contracts/mocks/WormholeRelayerMock.sol";

// solhint-disable-next-line no-empty-blocks
contract WormholeRelayerMock is WormholeRelayerMockBase {
    constructor(address _wormhole) WormholeRelayerMockBase(_wormhole) {}
}
