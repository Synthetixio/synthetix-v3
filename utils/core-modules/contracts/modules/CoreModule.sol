//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnerModule} from "./OwnerModule.sol";
import {UpgradeModule} from "./UpgradeModule.sol";

// solhint-disable-next-line no-empty-blocks
contract CoreModule is OwnerModule, UpgradeModule {

}
