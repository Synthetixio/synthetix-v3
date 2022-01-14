//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20 as ExampleToken} from "../../token/ERC20.sol";
import "../../satellite/SatelliteFactory.sol";

contract SatelliteFactoryMock is SatelliteFactory {
    //TODO: Update array declaration to use SetUtil library
    Satellite[] private _satellites;
    mapping(string => uint256) private _satellitePositions;

    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _satellites;
    }

    function getSatellites() public view returns (Satellite[] memory) {
        return _getSatellites();
    }

    function _setSatellite(Satellite memory satellite) internal {
        if (_satellitePositions[satellite.id] > 0) {
            _satellites[_satellitePositions[satellite.id] - 1] = satellite;
        } else {
            _satellites.push(satellite);
            _satellitePositions[satellite.id] = _satellites.length;
        }
    }

    function createSatelliteMock(string memory id) external {
        ExampleToken newSatellite = new ExampleToken();

        Satellite memory satellite = Satellite({
            id: id,
            contractName: type(ExampleToken).name,
            deployedAddress: address(newSatellite)
        });

        _setSatellite(satellite);
    }
}
