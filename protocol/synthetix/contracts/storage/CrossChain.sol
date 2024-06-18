//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "../interfaces/external/ICcipRouterClient.sol";

/**
 * @title System wide configuration for anything
 */
library CrossChain {
    using SetUtil for SetUtil.UintSet;

    event ProcessedCcipMessage(bytes payload, bytes result);

    error NotCcipRouter(address);
    error UnsupportedNetwork(uint64);
    error InsufficientCcipFee(uint256 requiredAmount, uint256 availableAmount);
    error InvalidMessage();

    bytes32 private constant _SLOT_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.synthetix.CrossChain"));

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

        if (data.tokenAmounts.length == 1) {
            address to = abi.decode(data.data, (address));

            caller = data.tokenAmounts[0].token;
            payload = abi.encodeWithSelector(
                IERC20.transfer.selector,
                to,
                data.tokenAmounts[0].amount
            );
        } else {
            revert InvalidMessage();
        }

        // at this point, everything should be good to send the message to ourselves.
        // the below `onlyCrossChain` function will verify that the caller is self
        (bool success, bytes memory result) = caller.call(payload);

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
                revert(result, len)
            }
        }
    }
}
