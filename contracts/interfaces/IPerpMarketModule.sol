//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

interface IPerpMarketModule is IMarket {
    function setSynthetix(ISynthetixSystem synthetix) external;
}
