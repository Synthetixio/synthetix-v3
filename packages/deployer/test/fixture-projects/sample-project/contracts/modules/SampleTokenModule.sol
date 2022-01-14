//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../token/SampleToken.sol";

contract SampleTokenModule is SatelliteFactory {
    function createSampleToken() external {
        SampleToken sampleToken = new SampleToken();
        emit SatelliteCreated("contracts/token/SampleToken.sol:SampleToken", address(sampleToken));
    }
}
