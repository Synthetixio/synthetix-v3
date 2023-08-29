//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IOffchainWormholeModule.sol";
import "../../interfaces/external/IWormholeReceiver.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";


import "../../storage/OracleManager.sol";
import "../../storage/Config.sol";
import "../../storage/CrossChainWormhole.sol";
import "../../utils/CrossChain.sol";

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract OffchainWormholeModule is IWormholeReceiver, IOffchainWormholeModule {
		using SetUtil for SetUtil.UintSet;

		function configureWormholeCrossChain(
				IWormholeRelayerSend send,
				IWormholeRelayerDelivery recv,
				IWormholeCrossChainRead read,
				uint64[] memory supportedNetworks,
				uint16[] memory selectors
		) external {
				OwnableStorage.onlyOwner();

				if (supportedNetworks.length != selectors.length) {
						revert ParameterError.InvalidParameter("selectors", "must match length of supportedNetworks");
				}
			
				CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();
				wcc.crossChainRead = read;
				wcc.sender = send;
				wcc.recv = recv;

				for (uint i = 0; i < supportedNetworks.length; i++) {
						wcc.supportedNetworks.add(supportedNetworks[i]);
						wcc.chainIdToSelector[supportedNetworks[i]] = selectors[i];
						wcc.selectorToChainId[selectors[i]] = supportedNetworks[i];
				}
		}

    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory additionalVaas,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
		) external payable {
				CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();

				if (msg.sender != address(wcc.recv)) {
						revert AccessError.Unauthorized(msg.sender);
				}

				address sourceAddr = address(uint160(uint(sourceAddress)));
				if (sourceAddr != address(this)) {
						revert AccessError.Unauthorized(sourceAddr);
				}

				if (wcc.supportedNetworks.contains(sourceChain)) {
						revert CrossChain.UnsupportedNetwork(sourceChain);
				}

        (bool success, bytes memory result) = address(this).call(payload);

        if (!success) {
            uint len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }

        emit ProcessedWormholeMessage(payload, result);
		}
}
