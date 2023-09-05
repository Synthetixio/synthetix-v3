//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../token/ERC20Permit.sol";

contract ERC20PermitMock is ERC20Permit {
		// solhint-disable-next-line payable/only-payable
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

		// solhint-disable-next-line payable/only-payable
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

		// solhint-disable-next-line payable/only-payable
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
