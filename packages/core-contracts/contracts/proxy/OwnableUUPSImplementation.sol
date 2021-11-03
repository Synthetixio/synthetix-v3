//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UniversalProxyImplementation.sol";
import "../ownership/Ownable.sol";

contract OwnableUUPSImplementation is UniversalProxyImplementation, Ownable {
    struct UnstructuredProxyStorage {
        address implementation;
        bool simulatingUpgrade;
    }

    struct OwnableStorage {
        address owner;
        address nominatedOwner;
    }

    function _getProxyStorage() internal pure returns (UnstructuredProxyStorage storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.unstructuredproxy")) - 1)
            store.slot := 0xbfc07d3b0c02b88cba74385713df4525f83b010704ab14717e932c54e90f12f3
        }
    }

    function _getOwnabletorage() internal pure returns (OwnableStorage storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.ownable")) - 1)
            store.slot := 0x7d471153053283506e6bb8fb411b01117fd9f58f2a2645729b3393cafaa2f619
        }
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _getProxyStorage().implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _getProxyStorage().implementation;
    }

    function _setSimulatingUpgrade(bool simulatingUpgrade) internal override {        
        _getProxyStorage().simulatingUpgrade = simulatingUpgrade;
    }

    function _getSimulatingUpgrade() internal view override returns (bool) {
        return _getProxyStorage().simulatingUpgrade;
    }

    function _setOwner(address newOwner) internal override {
        _getOwnabletorage().owner = newOwner;
    }

    function _getOwner() internal view override returns (address) {
        return _getOwnabletorage().owner;
    }

    function _setNominatedOwner(address newNominatedOwner) internal override {
        _getOwnabletorage().nominatedOwner = newNominatedOwner;
    }

    function _getNominatedOwner() internal view override returns (address) {
        return _getOwnabletorage().nominatedOwner;
    }

}
