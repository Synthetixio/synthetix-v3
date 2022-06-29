//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

interface IUSDToken is IERC20 {
    function mint(address to, uint amount) external;

    function burn(address to, uint amount) external;

    function setAllowance(
        address from,
        address spender,
        uint amount
    ) external;
}
