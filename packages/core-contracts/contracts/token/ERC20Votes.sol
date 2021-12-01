//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";

contract ERC20Votes is ERC20 {
    function getVotes(address account) public view virtual returns (uint256) {
        return balanceOf(account);
    }
}
