//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../storage/TokenStorage.sol";
import "../token/SampleToken.sol";

contract SampleTokenModule is SatelliteFactory, TokenStorage {
    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _tokenStore().satellites;
    }

    function getSampleTokenModuleSatellites() public view returns (Satellite[] memory) {
        return _getSatellites();
    }

    function createSampleToken(string memory id) external {
        SampleToken token = new SampleToken();

        Satellite memory satellite = Satellite({
            id: id,
            contractName: type(SampleToken).name,
            deployedAddress: address(token)
        });

        _setSatellite(satellite);
    }
}
