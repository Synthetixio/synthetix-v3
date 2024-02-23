//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./common/OwnerModule.sol";
import "./common/UpgradeModule.sol";

// The below contract is only used during initialization as a kernel for the first release which the system can be upgraded onto.
// Subsequent upgrades will not need this module bundle
// In the future on live networks, we may want to find some way to hardcode the owner address here to prevent grieving

// solhint-disable-next-line no-empty-blocks
contract InitialModuleBundle is OwnerModule, UpgradeModule {

}
