//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OwnableMixin.sol";
import "../common/CommonErrors.sol";

contract Ownable is OwnableMixin, CommonErrors {
    error NotNominated(address addr);
    error InvalidNomination(address addr);
    error NoNomination();

    event OwnerNominated(address newOwner);

    event OwnerChanged(address oldOwner, address newOwner);

    function acceptOwnership() external {
        OwnableNamespace storage store = _ownableStorage();

        address currentNominatedOwner = store.nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit OwnerChanged(store.owner, currentNominatedOwner);
        store.owner = currentNominatedOwner;

        store.nominatedOwner = address(0);
    }

    function nominateNewOwner(address newNominatedOwner) external onlyOwnerIfSet {
        OwnableNamespace storage store = _ownableStorage();

        if (newNominatedOwner == address(0)) {
            revert InvalidAddress(newNominatedOwner);
        }

        if (newNominatedOwner == store.nominatedOwner) {
            revert InvalidNomination(newNominatedOwner);
        }

        store.nominatedOwner = newNominatedOwner;
        emit OwnerNominated(newNominatedOwner);
    }

    function renounceNomination() external onlyOwner {
        OwnableNamespace storage store = _ownableStorage();

        if (store.nominatedOwner == address(0)) {
            revert NoNomination();
        }

        store.nominatedOwner = address(0);
    }

    function owner() external view returns (address) {
        return _ownableStorage().owner;
    }

    function nominatedOwner() external view returns (address) {
        return _ownableStorage().nominatedOwner;
    }
}
