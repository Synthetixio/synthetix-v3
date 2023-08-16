//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ChangeError} from "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IOwnable} from "@synthetixio/core-contracts/contracts/interfaces/IOwnable.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Guardian} from "../../storage/Guardian.sol";

contract OwnerModule is IOwnable {
    using SafeCastU256 for uint256;

    /**
     * @notice Thrown when an the ownership is accepted before the nomination delay
     */
    error OwnershipAcceptanceTooEarly();

    /**
     * @notice Accept ownership nomination an become the new owner, checks that nomination window have passed.
     */
    function acceptOwnership() public override {
        OwnableStorage.Data storage ownableStore = OwnableStorage.load();
        Guardian.Data storage guardianStore = Guardian.load();

        address currentNominatedOwner = ownableStore.nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        if (
            block.timestamp.to64() - guardianStore.ownershipRequestedAt <
            Guardian.ACCEPT_OWNERSHIP_DELAY
        ) {
            revert OwnershipAcceptanceTooEarly();
        }

        emit OwnerChanged(ownableStore.owner, currentNominatedOwner);

        ownableStore.owner = currentNominatedOwner;
        ownableStore.nominatedOwner = address(0);
        guardianStore.ownershipRequestedAt = 0;
    }

    /**
     * @notice Allows the current guardian to nominate a new owner.
     * @dev The nominated owner will have to call `acceptOwnership` in a separate transaction in order to finalize the action and become the new contract owner.
     * @param newNominatedOwner The address that is to become nominated.
     */
    function nominateNewOwner(address newNominatedOwner) public override {
        Guardian.onlyGuardian();

        OwnableStorage.Data storage ownableStore = OwnableStorage.load();
        Guardian.Data storage guardianStore = Guardian.load();

        if (newNominatedOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (
            newNominatedOwner == ownableStore.nominatedOwner ||
            newNominatedOwner == ownableStore.owner
        ) {
            revert ChangeError.NoChange();
        }

        guardianStore.ownershipRequestedAt = block.timestamp.to64();
        ownableStore.nominatedOwner = newNominatedOwner;

        emit OwnerNominated(newNominatedOwner);
    }

    /**
     * @inheritdoc IOwnable
     */
    function renounceNomination() external override {
        OwnableStorage.Data storage ownableStore = OwnableStorage.load();
        Guardian.Data storage guardianStore = Guardian.load();

        if (ownableStore.nominatedOwner != msg.sender) {
            revert NotNominated(msg.sender);
        }

        ownableStore.nominatedOwner = address(0);
        guardianStore.ownershipRequestedAt = 0;
    }

    /**
     * @inheritdoc IOwnable
     */
    function owner() external view override returns (address) {
        return OwnableStorage.load().owner;
    }

    /**
     * @inheritdoc IOwnable
     */
    function nominatedOwner() external view override returns (address) {
        return OwnableStorage.load().nominatedOwner;
    }
}
