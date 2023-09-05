//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IMulticallModule.sol";

contract MulticallReceiver {
    event MessageSenderTested(address indexed sender);

    function testMessageSender() external payable returns (address) {
        emit MessageSenderTested(IMulticallModule(msg.sender).getMessageSender());
        return msg.sender;
    }
}
