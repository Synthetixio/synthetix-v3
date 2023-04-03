
//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

import "../storage/InsuranceSettings.sol";

interface IMarketModule is IMarket {
    function setSettings(InsuranceSettings.Data memory settings) external;
}