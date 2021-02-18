//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../mixins/OwnerMixin.sol";


contract OwnerModule is OwnerMixin {
    /* MUTATIVE FUNCTIONS */

    function nominateOwner(address newNominatedOwner) public onlyOwner {
        require(newNominatedOwner != address(0), "Invalid nominated owner address");

        _ownerStorage().nominatedOwner = newNominatedOwner;
    }

    function rejectNomination() public onlyOwner {
        OwnerStorage storage store = _ownerStorage();

        require(store.nominatedOwner != address(0), "No nomination to reject");

        store.nominatedOwner = address(0);
    }

    function acceptOwnership() public {
        OwnerStorage storage store = _ownerStorage();

        if (store.owner == address(0)) {
            store.owner = msg.sender;
        } else {
            require(msg.sender == store.nominatedOwner, "Must be nominated");

            store.owner = store.nominatedOwner;
        }

        store.nominatedOwner = address(0);

        emit OwnerChanged(store.owner);
    }

    /* VIEW FUNCTIONS */

    function getOwner() public view returns (address) {
        return _ownerStorage().owner;
    }

    function getNominatedOwner() public view returns (address) {
        return _ownerStorage().nominatedOwner;
    }

    /* EVENTS */

    event OwnerChanged(address newOwner);
}
