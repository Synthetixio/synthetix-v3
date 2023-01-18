//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../token/ERC20.sol";
import "../../interfaces/IERC20Permit.sol";

contract VaultMock {
    IERC20Permit public token;

    function initialize(address _token) public {
        token = IERC20Permit(_token);
    }

    function depositWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        token.permit(msg.sender, address(this), amount, deadline, v, r, s);
        token.transferFrom(msg.sender, address(this), amount);
    }
}
