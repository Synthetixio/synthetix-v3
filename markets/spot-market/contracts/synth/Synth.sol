//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/OwnerModule.sol";
import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";

// solhint-disable-next-line no-empty-blocks
contract Synth is OwnerModule, TokenModule {
    function _isInitialized() internal view override(OwnerModule, TokenModule) returns (bool) {
        return OwnableStorage.load().initialized && ERC20Storage.load().decimals != 0;
    }
}
