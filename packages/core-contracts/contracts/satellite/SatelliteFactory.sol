//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ISatelliteFactory.sol";

abstract contract SatelliteFactory is ISatelliteFactory {
    function _getSatellites() internal view virtual returns (Satellite[] memory);
}
