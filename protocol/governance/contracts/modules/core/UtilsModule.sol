//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/main/contracts/storage/CrossChain.sol";
import "@synthetixio/main/contracts/interfaces/external/IAny2EVMMessageReceiver.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

import "../../interfaces/IUtilsModule.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract UtilsModule is IUtilsModule {
    using SetUtil for SetUtil.UintSet;
    using SafeCastU256 for uint256;

    /**
     * @inheritdoc IUtilsModule
     */
    function configureChainlinkCrossChain(address ccipRouter) external override {
        OwnableStorage.onlyOwner();

        CrossChain.Data storage cc = CrossChain.load();
        cc.ccipRouter = ICcipRouterClient(ccipRouter);
    }

    /**
     * @inheritdoc IUtilsModule
     */
    function setSupportedCrossChainNetworks(
        uint64[] memory supportedNetworks,
        uint64[] memory ccipSelectors
    ) external returns (uint256 numRegistered) {
        OwnableStorage.onlyOwner();

        uint64 myChainId = block.chainid.to64();

        if (ccipSelectors.length != supportedNetworks.length) {
            revert ParameterError.InvalidParameter("ccipSelectors", "must match length");
        }

        CrossChain.Data storage cc = CrossChain.load();
        for (uint i = 0; i < supportedNetworks.length; i++) {
            if (supportedNetworks[i] == myChainId) continue;
            if (
                supportedNetworks[i] != myChainId &&
                !cc.supportedNetworks.contains(supportedNetworks[i])
            ) {
                numRegistered++;
                cc.supportedNetworks.add(supportedNetworks[i]);
                emit NewSupportedCrossChainNetwork(supportedNetworks[i]);
            }

            cc.ccipChainIdToSelector[supportedNetworks[i]] = ccipSelectors[i];
            cc.ccipSelectorToChainId[ccipSelectors[i]] = supportedNetworks[i];
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
