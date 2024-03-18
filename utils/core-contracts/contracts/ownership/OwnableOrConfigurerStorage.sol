//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// import "./OwnableOrConfigurerStorage.sol";
import "../errors/AccessError.sol";

library OwnableOrConfigurerStorage {
    bytes32 private constant _SLOT_OWNABLE_STORAGE =
        keccak256(abi.encode("io.synthetix.core-contracts.Ownable"));
    bytes32 private constant _SLOT_CONFIGURER_STORAGE =
        keccak256(abi.encode("io.synthetix.core-contracts.Configurer"));

    struct OwnerData {
        address owner;
        address nominatedOwner;
    }

    struct ConfigurerData {
        address configurer;
        address nominatedConfigurer;
    }

    function loadOwner() internal pure returns (OwnerData storage store) {
        bytes32 s = _SLOT_OWNABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }

    function loadConfigurer() internal pure returns (ConfigurerData storage store) {
        bytes32 s = _SLOT_CONFIGURER_STORAGE;
        assembly {
            store.slot := s
        }
    }

    function onlyOwner() internal view {
        if (msg.sender != getOwner()) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function onlyOwnerOrConfigurer() internal view {
        if (msg.sender != getOwner() && msg.sender != getConfigurer()) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function getOwner() internal view returns (address) {
        return OwnableOrConfigurerStorage.loadOwner().owner;
    }

    function getConfigurer() internal view returns (address) {
        return OwnableOrConfigurerStorage.loadConfigurer().configurer;
    }
}
