//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "../common/CommonErrors.sol";
import "./ProxyStorage.sol";

abstract contract UUPSImplementation is ProxyStorage, ContractUtil, CommonErrors {
    error SterileImplementation(address implementation);
    error SimulatedUpgradeFailed();

    event Upgraded(address implementation);

    function upgradeTo(address newImplementation) public virtual;

    function _upgradeTo(address newImplementation) internal virtual {
        ProxyStore storage store = _proxyStore();

        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }

        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }

        if (!store.simulatingUpgrade && _implementationIsSterile(newImplementation)) {
            revert SterileImplementation(newImplementation);
        }

        store.implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function _implementationIsSterile(address candidateImplementation) internal virtual returns (bool) {
        (bool simulationReverted, bytes memory simulationResponse) = address(this).delegatecall(
            abi.encodeWithSelector(this.simulateUpgradeTo.selector, candidateImplementation)
        );

        return
            !simulationReverted &&
            keccak256(abi.encodePacked(simulationResponse)) == keccak256(abi.encodePacked(SimulatedUpgradeFailed.selector));
    }

    function simulateUpgradeTo(address newImplementation) public {
        ProxyStore storage store = _proxyStore();

        store.simulatingUpgrade = true;

        address currentImplementation = store.implementation;
        store.implementation = newImplementation;

        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSelector(this.upgradeTo.selector, currentImplementation, true)
        );

        if (!rollbackSuccessful || _proxyStore().implementation != currentImplementation) {
            revert SimulatedUpgradeFailed();
        }

        store.simulatingUpgrade = false;

        // solhint-disable-next-line reason-string
        revert();
    }

    function getImplementation() external view returns (address) {
        return _proxyStore().implementation;
    }
}
