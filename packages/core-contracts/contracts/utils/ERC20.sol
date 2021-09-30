//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../interfaces/IERC20.sol";

abstract contract ERC20 is IERC20 {
    function name() public view virtual override returns (string memory);

    function symbol() public view virtual override returns (string memory);

    // if there was a constructor decimals would be decalred as immutable!
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256);

    function balanceOf(address account) public view virtual override returns (uint256);

    function allowance(address owner, address spender) public view virtual override returns (uint256);

    function approve(address spender, uint256 amount) public virtual override returns (bool);

    function transfer(address to, uint amount) external virtual override returns (bool);

    function transferFrom(
        address from,
        address to,
        uint amount
    ) external virtual override returns (bool);
}
