//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/ERC20.sol";
import "../../satellite/SatelliteFactory.sol";

contract SatelliteFactoryMock is SatelliteFactory {
    Satellite[] private _satellites;

    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _satellites;
    }

    function getSatellites() public view returns (Satellite[] memory) {
        return _getSatellites();
    }

    function createSatelliteMock(bytes32 name) external {
        ERC20 newSatellite = new ERC20();

        Satellite memory satellite = Satellite({name: name, contractName: "ERC20", deployedAddress: address(newSatellite)});

        _satellites.push(satellite);
    }
}
