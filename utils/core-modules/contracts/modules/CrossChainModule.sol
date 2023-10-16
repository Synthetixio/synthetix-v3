//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../interfaces/IAssociatedSystemsModule.sol";
import "../interfaces/external/IAny2EVMMessageReceiver.sol";
import "../interfaces/ICrossChainModule.sol";

import "../storage/AssociatedSystem.sol";
import "../storage/CrossChain.sol";

/**
 * @title Module with assorted cross-chain functions.
 * @dev See ICrossChainModule.
 */
contract CrossChainModule is ICrossChainModule {
    using AssociatedSystem for AssociatedSystem.Data;
    using SetUtil for SetUtil.UintSet;
    using SafeCastU256 for uint256;

    /**
     * @inheritdoc ICrossChainModule
     */
    function configureChainlinkCrossChain(address ccipRouter) external override {
        OwnableStorage.onlyOwner();

        CrossChain.Data storage cc = CrossChain.load();

        cc.ccipRouter = ICcipRouterClient(ccipRouter);
    }

    /**
     * @inheritdoc ICrossChainModule
     */
    function setSupportedCrossChainNetworksWithTargets(
        uint64[] memory supportedNetworks,
        address[] memory supportedNetworkTargets,
        uint64[] memory ccipSelectors
    ) public returns (uint256 numRegistered) {
        OwnableStorage.onlyOwner();

        uint64 myChainId = block.chainid.to64();

        if (supportedNetworkTargets.length != supportedNetworks.length) {
            revert ParameterError.InvalidParameter("supportedNetworkTargets", "must match length");
        }

        if (ccipSelectors.length != supportedNetworks.length) {
            revert ParameterError.InvalidParameter("ccipSelectors", "must match length");
        }

        CrossChain.Data storage cc = CrossChain.load();
        for (uint i = 0; i < supportedNetworks.length; i++) {
            uint64 chainId = supportedNetworks[i];

            if (chainId == myChainId) continue;

            if (!cc.supportedNetworks.contains(chainId)) {
                numRegistered++;
                cc.supportedNetworks.add(chainId);
                emit NewSupportedCrossChainNetwork(chainId);
            }

            cc.ccipChainIdToSelector[chainId] = ccipSelectors[i];
            cc.ccipSelectorToChainId[ccipSelectors[i]] = chainId;
            cc.supportedNetworkTargets[chainId] = supportedNetworkTargets[i];
        }
    }

    /**
     * @inheritdoc ICrossChainModule
     */
    function setSupportedCrossChainNetworks(
        uint64[] memory supportedNetworks,
        uint64[] memory ccipSelectors
    ) public returns (uint256 numRegistered) {
        return
            setSupportedCrossChainNetworksWithTargets(
                supportedNetworks,
                new address[](supportedNetworks.length),
                ccipSelectors
            );
    }
}
