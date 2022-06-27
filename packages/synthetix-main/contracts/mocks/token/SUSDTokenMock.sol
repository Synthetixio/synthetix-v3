//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/SUSDToken.sol";

contract SUSDTokenMock is SUSDToken {
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
