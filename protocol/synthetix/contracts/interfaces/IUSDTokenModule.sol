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
    function transferCrossChain(
        uint256 destChainId,
        address to,
        uint256 amount
    ) external returns (uint256 feesPaidD18);

    /**
     * @notice Updates the token name
     * @param tokenName The new token name
     */
    function setTokenName(string memory tokenName) external;

    /**
     * @notice Updates the token symbol
     * @param tokenSymbol The new token symbol
     */
    function setTokenSymbol(string memory tokenSymbol) external;

    function burn(uint256 amount) external;
}
