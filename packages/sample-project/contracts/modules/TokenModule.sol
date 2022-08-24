//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/TokenStorage.sol";
import "../token/Token.sol";
import "../interfaces/ITokenModule.sol";

contract TokenModule is TokenStorage, ITokenModule {
    function createSampleToken(bytes32 name) external override {
        Token token = new Token();
        _tokenStore().tokens.push(Satellite({name: name, contractName: "Token", deployedAddress: address(token)}));
    }
}
