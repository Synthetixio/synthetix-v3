//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ICrossDomainMessenger.sol";

contract CrossDomainMessengerMock is ICrossDomainMessenger {
    address private _xDomainMessageSender;

    function xDomainMessageSender() public view returns (address) {
        return _xDomainMessageSender;
    }

    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 /* _gasLimit*/
    ) external {
        _xDomainMessageSender = msg.sender;

        (bool success, bytes memory response) = _target.call(_message);

        success;
        response;
    }
}
