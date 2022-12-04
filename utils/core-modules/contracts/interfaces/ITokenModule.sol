//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

/// @title ERC20 token for snxUSD
interface ITokenModule is IERC20 {
    /// @notice returns if `initialize` has been called by the owner
    function isInitialized() external returns (bool);

    /// @notice allows owner to initialize the token after attaching a proxy
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) external;

    /// @notice mints token amount to "to" address
    function mint(address to, uint amount) external;

    /// @notice burns token amount from "to" address
    function burn(address to, uint amount) external;

    /// @notice sets token amount allowance to spender by "from" address
    function setAllowance(address from, address spender, uint amount) external;
}
