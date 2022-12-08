//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorizableStorage.sol";
import "./Ownable.sol";
import "../interfaces/IAuthorizable.sol";
import "../errors/AddressError.sol";
import "../errors/ChangeError.sol";

contract Authorizable is Ownable, IAuthorizable {
    event AuthorizedChanged(address oldAuthorizad, address newAuthorized);

    function setNewAuthorized(address newAuthorized) public override onlyOwner {
        AuthorizableStorage.Data storage store = AuthorizableStorage.load();
        address oldAuthorized = store.authorized;

        if (newAuthorized == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newAuthorized == oldAuthorized) {
            revert ChangeError.NoChange();
        }

        store.authorized = newAuthorized;
        emit AuthorizedChanged(oldAuthorized, newAuthorized);
    }

    function authorized() external view override returns (address) {
        return AuthorizableStorage.load().authorized;
    }

    modifier onlyAuthorized() {
        AuthorizableStorage.onlyAuthorized();

        _;
    }
}
