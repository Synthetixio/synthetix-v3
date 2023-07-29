//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ChangeError} from "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OwnerModule as BaseOwnerModule} from "@synthetixio/core-modules/contracts/modules/OwnerModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Guardian} from "../../storage/Guardian.sol";

contract OwnerModule is BaseOwnerModule {
    using SafeCastU256 for uint256;

    /**
     * @notice Thrown when an the ownership is accepted before the nomination delay
     */
    error OwnershipAcceptanceTooEarly();

    function acceptOwnership() public override {
        super.acceptOwnership();

        Guardian.Data storage store = Guardian.load();

        if (block.timestamp.to64() - store.ownershipRequestedAt < Guardian.RESCUE_DELAY) {
            revert OwnershipAcceptanceTooEarly();
        }

        store.ownershipRequestedAt = 0;
    }

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

    function renounceNomination() external override {
        super.renounceNomination();

        Guardian.Data storage rescueStore = Guardian.load();
        rescueStore.requestedAt = 0;
    }
}
