//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../interfaces/IUtilsModule.sol";

import "../../storage/OracleManager.sol";
import "../../storage/Config.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract UtilsModule is IUtilsModule {
    using AssociatedSystem for AssociatedSystem.Data;

    /**
     * @inheritdoc IUtilsModule
     */
    function isTrustedForwarder(address forwarder) external pure returns (bool) {
        return ERC2771Context.isTrustedForwarder(forwarder);
    }

    /**
     * @inheritdoc IUtilsModule
     */
    function getTrustedForwarder() external pure returns (address) {
        return ERC2771Context.trustedForwarder();
    }

    /**
     * @inheritdoc IUtilsModule
     */
    function configureOracleManager(address oracleManagerAddress) external override {
        OwnableStorage.onlyOwner();

        OracleManager.Data storage oracle = OracleManager.load();
        oracle.oracleManagerAddress = oracleManagerAddress;
    }

    function setConfig(bytes32 k, bytes32 v) external override {
        OwnableStorage.onlyOwner();
        return Config.put(k, v);
    }

    function getConfig(bytes32 k) external view override returns (bytes32 v) {
        return Config.read(k, 0);
    }

    function getConfigUint(bytes32 k) external view override returns (uint256 v) {
        return Config.readUint(k, 0);
    }

    function getConfigAddress(bytes32 k) external view override returns (address v) {
        return Config.readAddress(k, address(0));
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return interfaceId == this.supportsInterface.selector;
    }
}
