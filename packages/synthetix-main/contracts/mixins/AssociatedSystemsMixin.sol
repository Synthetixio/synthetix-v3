//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "../storage/AssociatedSystemsStorage.sol";

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

contract AssociatedSystemsMixin is AssociatedSystemsStorage {
    function _getToken(bytes32 id) internal view returns (ITokenModule) {
        return ITokenModule(_associatedSystemsStore().satellites[id].proxy);
    }

    function _getNft(bytes32 id) internal view returns (INftModule) {
        return INftModule(_associatedSystemsStore().satellites[id].proxy);
    }

    modifier onlyIfAssociated(bytes32 id) {
        if (address(_associatedSystemsStore().satellites[id].proxy) == address(0)) {
            revert InitError.NotInitialized();
        }

        _;
    }
}
