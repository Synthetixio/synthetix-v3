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

    /**
     * @notice Allows users to transfer tokens cross-chain using CCIP. This is disabled until _CCIP_CHAINLINK_SEND is set in UtilsModule. This is currently included for testing purposes. Functionality will change, including fee collection, as CCIP continues development.
     * @param destChainId The id of the chain where tokens are to be transferred to.
     * @param to The destination address in the target chain.
     * @param amount The amount of tokens to be transferred, denominated with 18 decimals of precision.
     * @return gasTokenUsed The amount of fees paid in the cross-chain transfer, denominated with 18 decimals of precision.
     */
    function transferCrossChain(
        uint64 destChainId,
        address to,
        uint256 amount
    ) external payable returns (uint256 gasTokenUsed);
}
