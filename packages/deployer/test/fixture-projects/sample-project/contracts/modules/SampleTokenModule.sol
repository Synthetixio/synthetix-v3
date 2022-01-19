//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../storage/TokenStorage.sol";
import "../token/SampleToken.sol";

contract SampleTokenModule is SatellitesFactory, TokenStorage {
    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _tokenStore().satellites;
    }

    function getSampleTokenModuleSatellites() public view returns (Satellite[] memory) {
        return _getSatellites();
    }

    //TODO: Update array declaration to use SetUtil library
    function _setSatellite(Satellite memory satellite) internal {
        TokenStore storage s = _tokenStore();

        if (s.satellitePositions[satellite.id] > 0) {
            s.satellites[s.satellitePositions[satellite.id] - 1] = satellite;
        } else {
            s.satellites.push(satellite);
            s.satellitePositions[satellite.id] = s.satellites.length;
        }
    }

    function createSampleToken(bytes32 id) external {
        SampleToken token = new SampleToken();

        Satellite memory satellite = Satellite({
            id: id,
            contractName: type(SampleToken).name,
            deployedAddress: address(token)
        });

        _setSatellite(satellite);
    }
}
