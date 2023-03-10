//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/spot-market/contracts/interfaces/IAtomicOrderModule.sol";
import "@synthetixio/spot-market/contracts/interfaces/ISpotMarketFactoryModule.sol";

interface ISpotMarketSystem is IAtomicOrderModule, ISpotMarketFactoryModule {}
