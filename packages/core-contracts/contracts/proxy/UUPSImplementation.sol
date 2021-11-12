//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "../common/CommonErrors.sol";
import "./ProxyStorage.sol";

contract UUPSImplementation is ProxyStorage, ContractUtil, CommonErrors {
    error SterileImplementation(address implementation);
    error SimulatedUpgradeFailed();
    error UpgradeToNotCalledViaProxy();

    event Upgraded(address implementation);

    address private immutable __self = address(this);

    // WARNING!!!
    // It is critical that these two functions are protected in production.
    function safeUpgradeTo(address newImplementation) public {
        _upgradeTo(newImplementation, true);
    }
    function unsafeUpgradeTo(address newImplementation) public {
        _upgradeTo(newImplementation, false);
    }

    function _upgradeTo(address newImplementation, bool checkFertility) internal virtual {
        if (address(this) == __self || _proxyStore().implementation != __self) {
            revert UpgradeToNotCalledViaProxy();
        }

        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }

        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }

        if (checkFertility && _implementationIsSterile(newImplementation)) {
            revert SterileImplementation(newImplementation);
        }

        _proxyStore().implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _proxyStore().implementation;
    }

    function _implementationIsSterile(address candidateImplementation) internal virtual returns (bool) {
        (bool simulationReverted, bytes memory simulationResponse) = address(this).delegatecall(
            abi.encodeWithSelector(this.simulateUpgradeTo.selector, candidateImplementation)
        );

        return
            !simulationReverted &&
            keccak256(abi.encodePacked(simulationResponse)) ==
            keccak256(abi.encodePacked(SimulatedUpgradeFailed.selector));
    }

    function simulateUpgradeTo(address newImplementation) public {
        address currentImplementation = _proxyStore().implementation;
        _proxyStore().implementation = newImplementation;

        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSelector(this.unsafeUpgradeTo.selector, currentImplementation, 1)
        );

        if (!rollbackSuccessful || _proxyStore().implementation != currentImplementation) {
            revert SimulatedUpgradeFailed();
        }

        revert();
    }
}
