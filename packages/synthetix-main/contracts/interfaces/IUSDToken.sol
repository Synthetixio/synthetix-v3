//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

/// @title ERC20 token for snxUSD
interface IUSDToken is IERC20 {
    /// @notice mints USDToken amount to "to" address
    function mint(address to, uint amount) external;

    /// @notice burns USDToken amount from "to" address
    function burn(address to, uint amount) external;

    /// @notice sets USDToken amount allowance to spender by "from" address
    function setAllowance(
        address from,
        address spender,
        uint amount
    ) external;
}
