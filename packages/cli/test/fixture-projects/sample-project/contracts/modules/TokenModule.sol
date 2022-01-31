//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../storage/TokenStorage.sol";
import {Token as BaseToken} from "../token/Token.sol";
import "../interfaces/ITokenModule.sol";

contract TokenModule is SatelliteFactory, TokenStorage, ITokenModule {
    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _tokenStore().tokens;
    }

    function getTokenModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function createSampleToken(bytes32 name) external override {
        BaseToken token = new BaseToken();
        _tokenStore().tokens.push(Satellite({name: name, contractName: "BaseToken", deployedAddress: address(token)}));
    }
}
