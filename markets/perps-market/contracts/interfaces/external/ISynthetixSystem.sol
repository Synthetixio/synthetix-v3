//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAssociatedSystemsModule} from "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import {IMarketManagerModule} from "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import {IUtilsModule} from "@synthetixio/main/contracts/interfaces/IUtilsModule.sol";

interface ISynthetixSystem is IAssociatedSystemsModule, IMarketManagerModule, IUtilsModule {}
