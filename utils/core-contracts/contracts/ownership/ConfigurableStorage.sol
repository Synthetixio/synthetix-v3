//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../errors/AccessError.sol";
import "../utils/ERC2771Context.sol";
import "./OwnableStorage.sol";

library ConfigurableStorage {
    bytes32 private constant _SLOT_CONFIGURER_STORAGE =
        keccak256(abi.encode("io.synthetix.core-contracts.Configurer"));

    struct ConfigurerData {
        address configurer;
        address nominatedConfigurer;
    }

    function loadConfigurer() internal pure returns (ConfigurerData storage store) {
        bytes32 s = _SLOT_CONFIGURER_STORAGE;
        assembly {
            store.slot := s
        }
    }

    ///@dev reverts if the sender is not the owner or the configurer
    function onlyOwnerOrConfigurer() internal view {
        if (
            ERC2771Context._msgSender() != OwnableStorage.getOwner() &&
            ERC2771Context._msgSender() != getConfigurer()
        ) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
    }

    function getConfigurer() internal view returns (address) {
        return ConfigurableStorage.loadConfigurer().configurer;
    }
}
