//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {AddressUtil} from "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import {ChangeError} from "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import {UUPSImplementation} from "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ElectionSettings} from "../../storage/ElectionSettings.sol";
import {Council} from "../../storage/Council.sol";

contract UpgradeProposalModule is UUPSImplementation {
    using Council for Council.Data;

    function upgradeTo(address candidateImplementation) public override {
        OwnableStorage.onlyOwner();
        ProxyStore storage store = _proxyStore();

        if (store.simulatingUpgrade == true) {
            _upgradeTo(candidateImplementation);
        } else {
            _proposeUpgrade(candidateImplementation);
        }
    }

    function _proposeUpgrade(address newImplementation) internal {
        _validateImplementation(newImplementation);

        ElectionSettings.Data storage settings = Council.load().getNextElectionSettings();
        settings.proposedImplementation = newImplementation;
        emit Upgraded(address(this), newImplementation);
    }

    function _validateImplementation(address candidateImplementation) internal {
        if (candidateImplementation == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (!AddressUtil.isContract(candidateImplementation)) {
            revert AddressError.NotAContract(candidateImplementation);
        }

        ProxyStore storage store = _proxyStore();

        if (candidateImplementation == store.implementation) {
            revert ChangeError.NoChange();
        }

        if (_implementationIsSterile(candidateImplementation)) {
            revert ImplementationIsSterile(candidateImplementation);
        }
    }

    function getProposedImplementation() external view returns (address) {
        return Council.load().getNextElectionSettings().proposedImplementation;
    }

    function acceptUpgradeProposal() public {
        OwnableStorage.onlyOwner();
        ElectionSettings.Data storage settings = Council.load().getCurrentElectionSettings();
        _upgradeTo(settings.proposedImplementation);
    }

    function declineUpgradeProposal() public {
        OwnableStorage.onlyOwner();
        ElectionSettings.Data storage prevSettings = Council.load().getPreviousElectionSettings();
        ElectionSettings.Data storage currSettings = Council.load().getCurrentElectionSettings();

        address currentImplementation = this.getImplementation();

        if (currentImplementation != prevSettings.proposedImplementation) {
            _upgradeTo(prevSettings.proposedImplementation);
        }

        // Clean implementation proposal value, in the case the next Council needs
        // to also decline it, they will use this value instead of the currently declined one.
        currSettings.proposedImplementation = prevSettings.proposedImplementation;
    }
}
