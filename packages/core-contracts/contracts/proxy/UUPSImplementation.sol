//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "../common/CommonErrors.sol";
import "./ProxyStorage.sol";

abstract contract UUPSImplementation is ProxyStorage, ContractUtil, CommonErrors {
    error SterileImplementation(address implementation);
    error SimulatedUpgradeFailed();
    error MustInteractThroughProxy();

    event Upgraded(address implementation);

    constructor() {
        _proxyStore().implementationSelf = address(this);
    }

    // WARNING!!!
    // **************************************************************************
    // This function is intentionally not implemented, because
    // it is critical and should not be exposed by default.
    // It should be implemented with some protection like `onlyOwner`,
    // and simply call the underlying intenal function.
    // **************************************************************************
    function upgradeTo(address newImplementation) public virtual;

    // NOTE: This function uses a hack to emulate an optional parameter (which Solidity does not provide).
    // If the function is called with more than 36 bytes, the optional parameter is interpreted to be true.
    // Function selector: 4 bytes
    // Address parameter: 32 bytes
    // Total: 36 bytes
    function _upgradeTo(
        address newImplementation /*, skipFertilityCheck = false */
    ) internal virtual {
        ProxyStore storage store = _proxyStore();

        // Basic protection against upgrading to invalid addresses.
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }
        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }

        // Protection against attempts to destroy the implementation.
        if (address(this) == store.implementationSelf) {
            revert MustInteractThroughProxy();
        }

        // Protection against upgrading to an implementation that will
        // not be able to upgrade in the future (i.e. is "sterile").
        bool skipFertilityCheck = msg.data.length > 36; // selector + address = 36 bytes
        if (!skipFertilityCheck && _implementationIsSterile(newImplementation)) {
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
        address currentImplementation = _proxyStore().implementation;
        _proxyStore().implementation = newImplementation;

        // Append extra data to skip a 2nd (and thus recursive) fertility check.
        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSelector(this.upgradeTo.selector, currentImplementation, true)
        );

        if (!rollbackSuccessful || _proxyStore().implementation != currentImplementation) {
            revert SimulatedUpgradeFailed();
        }

        // solhint-disable-next-line reason-string
        revert();
    }

    function getImplementation() external view returns (address) {
        return _proxyStore().implementation;
    }
}
