//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ICrossDomainMessenger.sol";

contract CrossDomainMessengerMock is ICrossDomainMessenger {
    event MessageSent(bool success, bytes32 response);

    address private _xDomainMessageSender;

    function xDomainMessageSender() public view returns (address) {
        return _xDomainMessageSender;
    }

    function sendMessage(
        address target,
        bytes calldata message,
        uint32 /* gasLimit*/
    ) external {
        _xDomainMessageSender = msg.sender;

        (bool success, bytes memory response) = target.call(message);

        bytes32 responseParsed;

        assembly {
            // Ignore first word which is the length of the dynamic array.
            responseParsed := mload(add(32, response))
        }

        emit MessageSent(success, responseParsed);
    }
}
