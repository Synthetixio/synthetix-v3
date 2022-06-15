//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/SUSDToken.sol";

contract SUSDTokenMock is SUSDToken {
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
