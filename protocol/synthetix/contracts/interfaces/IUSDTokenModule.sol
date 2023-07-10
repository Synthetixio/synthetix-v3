//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/**
 * @title Module for managing the snxUSD token as an associated system.
 */
interface IUSDTokenModule is ITokenModule {
    /**
     * @notice Allows the core system to burn snxUSD held by the `from` address, provided that it has given allowance to `spender`.
     * @param from The address that holds the snxUSD to be burned.
     * @param spender The address to which the holder has given allowance to.
     * @param amount The amount of snxUSD to be burned, denominated with 18 decimals of precision.
     */
    function burnWithAllowance(address from, address spender, uint256 amount) external;

    /**
     * @notice Destroys `amount` of snxUSD tokens from the caller. This is derived from ERC20Burnable.sol and is currently included for testing purposes with CCIP token pools.
     * @param amount The amount of snxUSD to be burned, denominated with 18 decimals of precision.
     */
    function burn(uint256 amount) external;
}
