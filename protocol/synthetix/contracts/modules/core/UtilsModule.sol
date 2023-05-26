//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

import "../../interfaces/IUtilsModule.sol";

import "../../storage/CrossChain.sol";
import "../../storage/OracleManager.sol";
import "../../storage/Config.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract UtilsModule is IUtilsModule {
    using AssociatedSystem for AssociatedSystem.Data;
    using SetUtil for SetUtil.UintSet;

    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _CCIP_CHAINLINK_SEND = "ccipChainlinkSend";
    bytes32 private constant _CCIP_CHAINLINK_RECV = "ccipChainlinkRecv";
    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";

    /**
     * @inheritdoc IUtilsModule
     */
    function configureChainlinkCrossChain(
        address ccipRouter,
        address ccipTokenPool,
        address chainlinkFunctions
    ) external override {
        OwnableStorage.onlyOwner();

        CrossChain.Data storage cc = CrossChain.load();

        cc.ccipRouter = ICcipRouterClient(ccipRouter);
        cc.chainlinkFunctionsOracle = FunctionsOracleInterface(chainlinkFunctions);

        IAssociatedSystemsModule usdToken = IAssociatedSystemsModule(
            AssociatedSystem.load(_USD_TOKEN).proxy
        );

        usdToken.registerUnmanagedSystem(_CCIP_CHAINLINK_SEND, ccipRouter);
        usdToken.registerUnmanagedSystem(_CCIP_CHAINLINK_RECV, ccipRouter);
        usdToken.registerUnmanagedSystem(_CCIP_CHAINLINK_TOKEN_POOL, ccipTokenPool);
    }

    /**
     * @inheritdoc IUtilsModule
     */
    function setSupportedCrossChainNetworks(
        uint64[] memory supportedNetworks
    ) external returns (uint256 numRegistered) {
        OwnableStorage.onlyOwner();

        uint64 myChainId = uint64(block.chainid);

        CrossChain.Data storage cc = CrossChain.load();
        for (uint i = 0; i < supportedNetworks.length; i++) {
            if (
                supportedNetworks[i] != myChainId &&
                !cc.supportedNetworks.contains(supportedNetworks[i])
            ) {
                numRegistered++;
                cc.supportedNetworks.add(supportedNetworks[i]);
                emit NewSupportedCrossChainNetwork(supportedNetworks[i]);
            }
        }
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
}
