//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/modules/OwnerModule.sol";
import "@synthetixio/core-modules/contracts/modules/UpgradeModule.sol";

// solhint-disable-next-line no-empty-blocks
contract InitialModuleBundle is OwnerModule, UpgradeModule {

}
