//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import {CcipClient} from "../utils/CcipClient.sol";
import {IAny2EVMMessageReceiver} from "../interfaces/external/IAny2EVMMessageReceiver.sol";

contract CcipRouterMock {
    event CCIPSend(
        uint64 destinationChainSelector,
        CcipClient.EVM2AnyMessage message,
        bytes32 messageId
    );

    uint256 public sendNonce = 0;

    function ccipSend(
        uint64 destinationChainSelector,
        CcipClient.EVM2AnyMessage calldata message
    ) external payable virtual returns (bytes32 messageId) {
        sendNonce += 1;
        bytes32 _messageId = keccak256(abi.encodePacked(sendNonce));
        emit CCIPSend(destinationChainSelector, message, _messageId);
        return _messageId;
    }

    function getFee(
        uint64, // destinationChainSelector
        CcipClient.EVM2AnyMessage memory // message
    ) external view virtual returns (uint256 fee) {
        // TODO: some mock fee, maybe this should be hardcoded? more intelligent?
        return 0;
    }

    function __ccipReceive(
        address target,
        CcipClient.Any2EVMMessage memory message
    ) external payable {
        (bool success, bytes memory result) = target.call(
            abi.encodeWithSelector(IAny2EVMMessageReceiver.ccipReceive.selector, message)
        );

        if (!success) {
            uint256 len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }
    }
}
