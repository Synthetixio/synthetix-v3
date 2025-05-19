// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// Synthetix V3 Core Module Interfaces
import {IAccountModule} from "@synthetixio/main/contracts/interfaces/IAccountModule.sol";
import {
    IAssociatedSystemsModule
} from "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import {
    IFeatureFlagModule
} from "@synthetixio/core-modules/contracts/interfaces/IFeatureFlagModule.sol";
import {
    ICollateralConfigurationModule
} from "../../contracts/interfaces/ICollateralConfigurationModule.sol";

// Synthetix V3 Perps Market Module Interfaces
import {
    IPerpsMarketFactoryModule
} from "../../contracts/interfaces/IPerpsMarketFactoryModule.sol";
import {IPerpsAccountModule} from "../../contracts/interfaces/IPerpsAccountModule.sol";
import {IPerpsMarketModule} from "../../contracts/interfaces/IPerpsMarketModule.sol";
import {IBookOrderModule} from "../../contracts/interfaces/IBookOrderModule.sol";
import {IAsyncOrderModule} from "../../contracts/interfaces/IAsyncOrderModule.sol";
import {ILiquidationModule} from "../../contracts/interfaces/ILiquidationModule.sol";
import {
    IMarketConfigurationModule
} from "../../contracts/interfaces/IMarketConfigurationModule.sol";
import {
    IGlobalPerpsMarketModule
} from "../../contracts/interfaces/IGlobalPerpsMarketModule.sol";
import {IOwnable} from "@synthetixio/core-contracts/contracts/interfaces/IOwnable.sol";

/**
 * @title IPerpsMarketProxy
 * @notice A proxy router for the standard Synthetix V3 Perps Market Modules.
 * @dev This contract holds addresses for deployed instances of the perps market modules.
 */
interface IPerpsMarketProxy is
    IAccountModule,
    IAssociatedSystemsModule,
    IPerpsMarketFactoryModule,
    IPerpsAccountModule,
    IPerpsMarketModule,
    IBookOrderModule,
    IAsyncOrderModule,
    IFeatureFlagModule,
    ILiquidationModule,
    IMarketConfigurationModule,
    ICollateralConfigurationModule,
    IGlobalPerpsMarketModule,
    IOwnable
{}
