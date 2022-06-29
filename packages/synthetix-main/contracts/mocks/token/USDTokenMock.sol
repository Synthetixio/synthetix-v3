//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/USDToken.sol";

contract USDTokenMock is USDToken {
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
