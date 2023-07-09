//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

interface IPerpMarketFactoryModule is IMarket {
    /**
     * @dev Initialises references to the Synthetix core system.
     */
    function setSynthetix(ISynthetixSystem synthetix) external;
}
