//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

// solhint-disable-next-line no-empty-blocks
contract Proxy is UUPSProxy(0x0000000000000000000000000000000000000001) {

}
