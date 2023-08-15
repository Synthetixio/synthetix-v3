//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ChangeError} from "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import {Guardian} from "../../storage/Guardian.sol";

contract GuardianModule {
    /**
     * @notice Thrown when an address tries to accept guardian role but has not been nominated.
     * @param addr The address that is trying to accept the guardian role.
     */
    error NotNominated(address addr);

    /**
     * @notice Emitted when an address has been nominated.
     * @param newOwner The address that has been nominated.
     */
    event GuardianNominated(address newOwner);

    /**
     * @notice Emitted when the guardianship of the contract has changed.
     * @param oldOwner The previous guardian of the contract.
     * @param newOwner The new guardian of the contract.
     */
    event GuardianChanged(address oldOwner, address newOwner);

    function acceptGuardianship() public {
        Guardian.Data storage store = Guardian.load();

        address currentNominatedGuardian = store.nominatedGuardian;
        if (msg.sender != currentNominatedGuardian) {
            revert NotNominated(msg.sender);
        }

        emit GuardianChanged(store.guardian, currentNominatedGuardian);

        store.guardian = currentNominatedGuardian;
        store.nominatedGuardian = address(0);
        store.ownershipRequestedAt = 0;
    }

    function nominateNewGuardian(address newNominatedGuardian) public {
        Guardian.onlyGuardian();

        Guardian.Data storage store = Guardian.load();

        if (newNominatedGuardian == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newNominatedGuardian == store.nominatedGuardian) {
            revert ChangeError.NoChange();
        }

        store.nominatedGuardian = newNominatedGuardian;
        emit GuardianNominated(newNominatedGuardian);
    }

    function renounceGuardianNomination() external {
        Guardian.Data storage store = Guardian.load();

        if (store.nominatedGuardian != msg.sender) {
            revert NotNominated(msg.sender);
        }

        store.nominatedGuardian = address(0);
        store.ownershipRequestedAt = 0;
    }
}
