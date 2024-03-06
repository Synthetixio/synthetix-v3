//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IAtomicOrderModule} from "@synthetixio/spot-market/contracts/interfaces/IAtomicOrderModule.sol";
import {IMarketConfigurationModule} from "@synthetixio/spot-market/contracts/interfaces/IMarketConfigurationModule.sol";
import {ISpotMarketFactoryModule} from "@synthetixio/spot-market/contracts/interfaces/ISpotMarketFactoryModule.sol";

// solhint-disable-next-line no-empty-blocks
interface ISpotMarketSystem is IAtomicOrderModule, ISpotMarketFactoryModule, IMarketConfigurationModule {}
