//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "../storage/AssociatedSystemsStorage.sol";

import "../interfaces/ITokenModule.sol";
import "../interfaces/INftModule.sol";

contract AssociatedSystemsMixin is AssociatedSystemsStorage {
    error MismatchAssociatedSystemKind(bytes32 expected, bytes32 actual);

    bytes32 internal constant _KIND_ERC20 = "erc20";
    bytes32 internal constant _KIND_ERC721 = "erc721";
    bytes32 internal constant _KIND_UNMANAGED = "unmanaged";

    function _getSystemAddress(bytes32 id) internal view returns (address) {
        return _associatedSystemsStore().satellites[id].proxy;
    }

    function _getToken(bytes32 id) internal view returns (ITokenModule) {
        _requireKind(id, _KIND_ERC20);
        return ITokenModule(_associatedSystemsStore().satellites[id].proxy);
    }

    function _getNft(bytes32 id) internal view returns (INftModule) {
        _requireKind(id, _KIND_ERC721);
        return INftModule(_associatedSystemsStore().satellites[id].proxy);
    }

    function _requireKind(bytes32 id, bytes32 kind) internal view {
        bytes32 actualKind = _associatedSystemsStore().satellites[id].kind;

        if (actualKind != kind && actualKind != _KIND_UNMANAGED) {
            revert MismatchAssociatedSystemKind(kind, actualKind);
        }
    }

    modifier onlyIfAssociated(bytes32 id) {
        if (address(_associatedSystemsStore().satellites[id].proxy) == address(0)) {
            revert InitError.NotInitialized();
        }

        _;
    }
}
