//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/DecayToken.sol";

// solhint-disable-next-line no-empty-blocks
contract DecayTokenMock is DecayToken {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function setInterestRate(uint256 rate) external {
        _setInterestRate(rate);
    }
}
