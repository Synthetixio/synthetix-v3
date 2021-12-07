//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract ElectionTokenMock is ERC20 {
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
