//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "../interfaces/external/ICcipRouterClient.sol";

contract CcipRouterMock {
    // solhint-disable no-empty-blocks
    function ccipSend(
        uint64 destinationChainId,
        CcipClient.EVM2AnyMessage calldata message
    ) external payable virtual returns (bytes32 messageId) {}

    function getFee(
        uint64 destinationChainId,
        CcipClient.EVM2AnyMessage memory message
    ) external view virtual returns (uint256 fee) {}
    // solhint-enable no-empty-blocks
}
