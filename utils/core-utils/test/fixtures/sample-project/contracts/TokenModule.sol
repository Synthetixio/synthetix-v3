//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Token as BaseToken} from "./Token.sol";

contract TokenModule {
    address[] private _tokens;

    function createToken(string memory name) external {
        BaseToken token = new BaseToken(name);
        _tokens.push(address(token));
    }
}
