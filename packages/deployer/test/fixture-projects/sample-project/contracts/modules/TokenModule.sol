//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../storage/TokenStorage.sol";
import "../token/Token.sol";

contract TokenModule is SatelliteFactory, TokenStorage {
    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _tokenStore().tokens;
    }

    function getTokenModuleSatellites() public view returns (Satellite[] memory) {
        return _getSatellites();
    }

    function createSampleToken(bytes32 name) external {
        Token token = new Token();
        _tokenStore().tokens.push(Satellite({name: name, contractName: "Token", deployedAddress: address(token)}));
    }
}
