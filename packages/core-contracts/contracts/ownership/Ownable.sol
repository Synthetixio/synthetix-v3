//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OwnableMixin.sol";
import "../interfaces/IOwnable.sol";
import "../common/CommonErrors.sol";

contract Ownable is IOwnable, OwnableMixin, CommonErrors {
    function acceptOwnership() external override {
        OwnableStore storage store = _ownableStore();

        address currentNominatedOwner = store.nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit OwnerChanged(store.owner, currentNominatedOwner);
        store.owner = currentNominatedOwner;

        store.nominatedOwner = address(0);
    }

    function nominateNewOwner(address newNominatedOwner) external override onlyOwnerIfSet {
        OwnableStore storage store = _ownableStore();

        if (newNominatedOwner == address(0)) {
            revert InvalidAddress(newNominatedOwner);
        }

        if (newNominatedOwner == store.nominatedOwner) {
            revert InvalidNomination(newNominatedOwner);
        }

        store.nominatedOwner = newNominatedOwner;
        emit OwnerNominated(newNominatedOwner);
    }

    function renounceNomination() external override onlyOwner {
        OwnableStore storage store = _ownableStore();

        if (store.nominatedOwner == address(0)) {
            revert NoNomination();
        }

        store.nominatedOwner = address(0);
    }

    function owner() external override view returns (address) {
        return _ownableStore().owner;
    }

    function nominatedOwner() external override view returns (address) {
        return _ownableStore().nominatedOwner;
    }
}
