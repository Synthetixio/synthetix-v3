//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import {CcipClient} from "../utils/CcipClient.sol";

contract CcipRouterMock {
    event CCIPSend(uint64 destinationChainId, CcipClient.EVM2AnyMessage message, bytes32 messageId);

    uint256 sendNonce = 0;

    function ccipSend(
        uint64 destinationChainId,
        CcipClient.EVM2AnyMessage calldata message
    ) external payable virtual returns (bytes32 messageId) {
        sendNonce += 1;
        bytes32 _messageId = keccak256(abi.encodePacked(sendNonce));
        emit CCIPSend(destinationChainId, message, _messageId);
        return _messageId;
    }

    function getFee(
        uint64, // destinationChainId
        CcipClient.EVM2AnyMessage memory // message
    ) external view virtual returns (uint256 fee) {
        // TODO: some mock fee, maybe this should be hardcoded? more intelligent?
        return 0;
    }
}
