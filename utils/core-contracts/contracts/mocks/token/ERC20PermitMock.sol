//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../token/ERC20Permit.sol";

contract ERC20PermitMock is ERC20Permit {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public payable {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function mint(uint256 amount) external payable {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external payable {
        _burn(msg.sender, amount);
    }
}
