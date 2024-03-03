//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAssociatedSystemsModule} from "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import {IMarketManagerModule} from "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import {IMarketCollateralModule} from "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import {IUtilsModule} from "@synthetixio/main/contracts/interfaces/IUtilsModule.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IVaultModule} from "@synthetixio/main/contracts/interfaces/IVaultModule.sol";

// solhint-disable-next-line no-empty-blocks
interface ISynthetixSystem is
    IAssociatedSystemsModule,
    IMarketCollateralModule,
    IMarketManagerModule,
    IUtilsModule,
    IRewardsManagerModule,
    IVaultModule
{}
