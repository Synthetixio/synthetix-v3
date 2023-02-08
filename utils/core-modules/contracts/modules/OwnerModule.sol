//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/IOwnerModule.sol";

/**
 * @title Module for giving a system owner based access control.
 * See IOwnerModule.
 */
// solhint-disable-next-line no-empty-blocks
contract OwnerModule is Ownable, IOwnerModule {
    // no impl intentionally
}
