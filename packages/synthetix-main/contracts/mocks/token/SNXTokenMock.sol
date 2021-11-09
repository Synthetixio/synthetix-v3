//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/SNXToken.sol";

contract SNXTokenMock is SNXToken {
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
