//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for the cross-chain transfers of stablecoins.
 */
interface ICrossChainUSDModule {
    event TransferCrossChainInitiated(
        uint64 indexed destChainId,
        address indexed to,
        uint256 indexed amount,
        address sender
    );

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
