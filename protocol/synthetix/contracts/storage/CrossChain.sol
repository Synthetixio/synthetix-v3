//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../interfaces/external/ICcipRouterClient.sol";
import "../interfaces/external/FunctionsOracleInterface.sol";

/**
 * @title System wide configuration for anything
 */
library CrossChain {
    using SetUtil for SetUtil.UintSet;

    event ProcessedCcipMessage(bytes data, bytes result);

    error NotCcipRouter(address);
    error UnsupportedNetwork(uint64);

    bytes32 private constant _SLOT_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.synthetix.CrossChain"));

    struct Data {
        ICcipRouterClient ccipRouter;
        FunctionsOracleInterface chainlinkFunctionsOracle;
        SetUtil.UintSet supportedNetworks;
        mapping(uint64 => uint64) ccipChainIdToSelector;
        mapping(uint64 => uint64) ccipSelectorToChainId;
        mapping(bytes32 => bytes32) chainlinkFunctionsRequestInfo;
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    function processCcipReceive(Data storage self, CcipClient.Any2EVMMessage memory data) internal {
        Data storage self = load();
        if (address(self.ccipRouter) == address(0) || msg.sender != address(self.ccipRouter)) {
            revert NotCcipRouter(msg.sender);
        }

        uint64 sourceChainId = self.ccipSelectorToChainId[data.sourceChainId];

        if (self.supportedNetworks.contains(sourceChainId)) {
            revert UnsupportedNetwork(sourceChainId);
        }

        address sender = abi.decode(data.sender, (address));
        if (sender != address(this)) {
            revert AccessError.Unauthorized(sender);
        }

        // at this point, everything should be good to send the message to ourselves.
        // the below `onlyCrossChain` function will verify that the caller is self
        (bool success, bytes memory result) = address(this).call(data.data);

        if (!success) {
            uint len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }

        emit ProcessedCcipMessage(data.data, result);
    }

    function onlyCrossChain() internal view {
        if (msg.sender != address(this)) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function transmit(
        Data storage self,
        uint64 chainId,
        bytes memory data,
        uint256 gasLimit
    ) internal returns (uint256 gasTokenUsed) {
        uint64[] memory chains = new uint64[](1);
        chains[0] = chainId;
        return broadcast(self, chains, data, gasLimit);
    }

    /**
     * @dev Sends a message to one or more chains
     */
    function broadcast(
        Data storage self,
        uint64[] memory chains,
        bytes memory data,
        uint256 gasLimit
    ) internal returns (uint256 gasTokenUsed) {
        ICcipRouterClient router = self.ccipRouter;

        CcipClient.EVM2AnyMessage memory sentMsg = CcipClient.EVM2AnyMessage(
            abi.encode(address(this)), // abi.encode(receiver address) for dest EVM chains
            data, // Data payload
            new CcipClient.EVMTokenAmount[](0), // Token transfers
            address(0), // Address of feeToken. address(0) means you will send msg.value.
            CcipClient._argsToBytes(CcipClient.EVMExtraArgsV1(gasLimit, true))
        );

        for (uint i = 0; i < chains.length; i++) {
            if (chains[i] == block.chainid) {
                (bool success, bytes memory result) = address(this).call(data);

                if (!success) {
                    uint256 len = result.length;
                    assembly {
                        revert(result, len)
                    }
                }
            } else {
                uint64 chainSelector = self.ccipChainIdToSelector[chains[i]];
                uint256 fee = router.getFee(chainSelector, sentMsg);
                router.ccipSend{value: fee}(chainSelector, sentMsg);

                gasTokenUsed += fee;
            }
        }
    }

    function refundLeftoverGas(uint256 gasTokenUsed) internal returns (uint256 amountRefunded) {
        amountRefunded = msg.value - gasTokenUsed;

        (bool success, bytes memory result) = msg.sender.call{value: amountRefunded}("");

        if (!success) {
            uint256 len = result.length;
            assembly {
                revert(result, len)
            }
        }
    }
}
