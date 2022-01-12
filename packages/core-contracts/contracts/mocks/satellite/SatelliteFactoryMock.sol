//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/ERC20.sol";
import "../../satellite/SatelliteFactory.sol";

contract SatelliteFactoryMock is SatelliteFactory {
    function createSatelliteMock() external {
        ERC20 newSatellite = new ERC20();
        emit SatelliteCreated("contracts/token/ERC20.sol:ERC20", address(newSatellite));
    }
}
