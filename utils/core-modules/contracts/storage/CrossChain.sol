//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "../interfaces/external/ICcipRouterClient.sol";

/**
 * @title System wide configuration for anything related to cross-chain
 */
library CrossChain {
    using SetUtil for SetUtil.UintSet;
    using SafeCastU256 for uint256;

    event ProcessedCcipMessage(bytes payload, bytes result);

    error NotCcipRouter(address);
    error UnsupportedNetwork(uint64);
    error InvalidNetwork(uint64);
    error InsufficientCcipFee(uint256 requiredAmount, uint256 availableAmount);
    error InvalidMessage();

    bytes32 private constant _SLOT_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.core-modules.CrossChain"));

    struct Data {
        ICcipRouterClient ccipRouter;
        SetUtil.UintSet supportedNetworks;
        mapping(uint64 => uint64) ccipChainIdToSelector;
        mapping(uint64 => uint64) ccipSelectorToChainId;
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    function validateChainId(Data storage self, uint256 chainId) internal view {
        if (!self.supportedNetworks.contains(chainId)) {
            revert UnsupportedNetwork(chainId.to64());
        }
    }

    function processCcipReceive(Data storage self, CcipClient.Any2EVMMessage memory data) internal {
        if (
            address(self.ccipRouter) == address(0) ||
            ERC2771Context._msgSender() != address(self.ccipRouter)
        ) {
            revert NotCcipRouter(ERC2771Context._msgSender());
        }

        uint64 sourceChainId = self.ccipSelectorToChainId[data.sourceChainSelector];

        if (!self.supportedNetworks.contains(sourceChainId)) {
            revert UnsupportedNetwork(sourceChainId);
        }

        address sender = abi.decode(data.sender, (address));
        if (sender != address(this)) {
            revert AccessError.Unauthorized(sender);
        }

        address caller;
        bytes memory payload;
        bool success;
        bytes memory result;

        if (data.tokenAmounts.length == 1) {
            address to = abi.decode(data.data, (address));

            caller = data.tokenAmounts[0].token;
            payload = abi.encodeWithSelector(
                IERC20.transfer.selector,
                to,
                data.tokenAmounts[0].amount
            );

            // at this point, everything should be good to send the message to ourselves.
            // the below `onlyCrossChain` function will verify that the caller is self
            (success, result) = caller.call(payload);
        } else if (data.tokenAmounts.length == 0) {
            (success, result) = address(this).call(data.data);
        } else {
            revert InvalidMessage();
        }

        if (!success) {
            uint256 len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }

        emit ProcessedCcipMessage(payload, result);
    }

    function onlyCrossChain() internal view {
        if (ERC2771Context._msgSender() != address(this)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
    }

    function getChainIdAt(Data storage self, uint64 index) internal view returns (uint64) {
        return self.supportedNetworks.valueAt(index + 1).to64();
    }

    function getSupportedNetworks(Data storage self) internal view returns (uint64[] memory) {
        SetUtil.UintSet storage supportedNetworks = self.supportedNetworks;
        uint256[] memory supportedChains = supportedNetworks.values();
        uint64[] memory chains = new uint64[](supportedChains.length);
        for (uint256 i = 0; i < supportedChains.length; i++) {
            uint64 chainId = supportedChains[i].to64();
            chains[i] = chainId;
        }
        return chains;
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

        for (uint256 i = 0; i < chains.length; i++) {
            uint64 destChainId = chains[i];

            if (destChainId == block.chainid) {
                (bool success, bytes memory result) = address(this).call(data);

                if (!success) {
                    uint256 len = result.length;
                    assembly {
                        revert(add(result, 0x20), len)
                    }
                }
            } else {
                CcipClient.EVM2AnyMessage memory sentMsg = CcipClient.EVM2AnyMessage(
                    abi.encode(address(this)), // abi.encode(receiver address) for dest EVM chains
                    data, // Data payload
                    new CcipClient.EVMTokenAmount[](0), // Token transfers
                    address(0), // Address of feeToken. address(0) means you will send msg.value.
                    CcipClient._argsToBytes(CcipClient.EVMExtraArgsV1(gasLimit, false))
                );

                uint64 chainSelector = self.ccipChainIdToSelector[destChainId];
                uint256 fee = router.getFee(chainSelector, sentMsg);

                // need to check sufficient fee here or else the error is very confusing
                if (address(this).balance < fee) {
                    revert InsufficientCcipFee(fee, address(this).balance);
                }

                router.ccipSend{value: fee}(chainSelector, sentMsg);

                gasTokenUsed += fee;
            }
        }

        CrossChain.refundLeftoverGas(gasTokenUsed);
    }

    /**
     * @dev Transfers tokens to a destination chain.
     */
    function teleport(
        Data storage self,
        uint64 destChainId,
        address token,
        uint256 amount,
        uint256 gasLimit
    ) internal returns (uint256 gasTokenUsed) {
        ICcipRouterClient router = self.ccipRouter;

        CcipClient.EVMTokenAmount[] memory tokenAmounts = new CcipClient.EVMTokenAmount[](1);
        tokenAmounts[0] = CcipClient.EVMTokenAmount(token, amount);

        bytes memory data = abi.encode(ERC2771Context._msgSender());

        CcipClient.EVM2AnyMessage memory sentMsg = CcipClient.EVM2AnyMessage(
            abi.encode(address(this)), // abi.encode(receiver address) for dest EVM chains
            data,
            tokenAmounts,
            address(0), // Address of feeToken. address(0) means you will send msg.value.
            CcipClient._argsToBytes(CcipClient.EVMExtraArgsV1(gasLimit, false))
        );

        uint64 chainSelector = self.ccipChainIdToSelector[destChainId];
        uint256 fee = router.getFee(chainSelector, sentMsg);

        // need to check sufficient fee here or else the error is very confusing
        if (address(this).balance < fee) {
            revert InsufficientCcipFee(fee, address(this).balance);
        }

        router.ccipSend{value: fee}(chainSelector, sentMsg);

        return fee;
    }

    function refundLeftoverGas(uint256 gasTokenUsed) internal returns (uint256 amountRefunded) {
        amountRefunded = msg.value - gasTokenUsed;

        (bool success, bytes memory result) = ERC2771Context._msgSender().call{
            value: amountRefunded
        }("");

        if (!success) {
            uint256 len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }
    }
}
