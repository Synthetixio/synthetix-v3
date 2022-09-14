//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorizableStorage.sol";
import "../errors/AccessError.sol";

contract AuthorizableMixin is AuthorizableStorage {
    modifier onlyAuthorized() {
        _onlyAuthorized();

        _;
    }

    function _onlyAuthorized() internal view {
        if (msg.sender != _getAuthorized()) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function _getAuthorized() internal view returns (address) {
        return _authorizableStore().authorized;
    }
}
