//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IUUPSImplementation.sol";
import "../errors/AddressError.sol";
import "../errors/ChangeError.sol";
import "../utils/AddressUtil.sol";
import "./ProxyStorage.sol";

abstract contract UUPSImplementation is IUUPSImplementation, ProxyStorage {
    event Upgraded(address implementation);
    event ImplementationNominated(address newImplementation);

    error ImplementationIsSterile(address implementation);
    error UpgradeSimulationFailed();
    error NotNominated(address addr);

    function _nominateNewImplementation(address newImplementation) internal virtual {
        if (newImplementation == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (!AddressUtil.isContract(newImplementation)) {
            revert AddressError.NotAContract(newImplementation);
        }

        ProxyStore storage store = _proxyStore();

        if (newImplementation == store.implementation) {
            revert ChangeError.NoChange();
        }

        store.nominatedImplementation = newImplementation;

        emit ImplementationNominated(newImplementation);
    }

    function _acceptUpgradeNomination() internal virtual {
        ProxyStore storage store = _proxyStore();

        address currentNominatedImpementation = store.nominatedImplementation;
        if (msg.sender != currentNominatedImpementation) {
            revert NotNominated(msg.sender);
        }

        if (!store.simulatingUpgrade && _implementationIsSterile(newImplementation)) {
            revert ImplementationIsSterile(newImplementation);
        }

        store.nominatedImplementation = address(0);
        store.implementation = currentNominatedImpementation;

        emit Upgraded(newImplementation);
    }

    function _renounceUpgradeNomination() internal virtual {
        ProxyStore storage store = _proxyStore();

        if (store.nominatedImplementation != msg.sender) {
            revert NotNominated(msg.sender);
        }

        store.nominatedImplementation = address(0);
    }

    function _implementationIsSterile(address candidateImplementation) internal virtual returns (bool) {
        (bool simulationReverted, bytes memory simulationResponse) = address(this).delegatecall(
            abi.encodeWithSelector(this.simulateUpgradeTo.selector, candidateImplementation)
        );

        return
            !simulationReverted &&
            keccak256(abi.encodePacked(simulationResponse)) == keccak256(abi.encodePacked(UpgradeSimulationFailed.selector));
    }

    function simulateUpgradeTo(address newImplementation) public override {
        ProxyStore storage store = _proxyStore();

        store.simulatingUpgrade = true;

        address currentImplementation = store.implementation;
        store.implementation = newImplementation;

        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSelector(this.nominateNewImplementation.selector, currentImplementation, true)
        );

        newImplementation.acceptUpgradeNomination();

        if (!rollbackSuccessful || _proxyStore().implementation != currentImplementation) {
            revert UpgradeSimulationFailed();
        }

        store.simulatingUpgrade = false;

        // solhint-disable-next-line reason-string
        revert();
    }

    function getImplementation() external view override returns (address) {
        return _proxyStore().implementation;
    }
}
