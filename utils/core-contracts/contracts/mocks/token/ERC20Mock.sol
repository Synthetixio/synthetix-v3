//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../token/ERC20.sol";

contract ERC20Mock is ERC20 {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function mintFor(address target, uint256 amount) external {
        _mint(target, amount);
    }

    function burnFor(address target, uint256 amount) external {
        _burn(target, amount);
    }

    function mint(uint256 amount) external {
        _mint(ERC2771Context._msgSender(), amount);
    }

    function burn(uint256 amount) external {
        _burn(ERC2771Context._msgSender(), amount);
    }
}
