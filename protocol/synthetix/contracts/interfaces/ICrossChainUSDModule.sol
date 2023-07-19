//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for the cross-chain transfers of stablecoins.
 */
interface ICrossChainUSDModule {
    event TransferCrossChainInitiated(
        uint64 indexed destChainId,
        uint256 indexed amount,
        address sender
    );

    /**
     * @notice Allows users to transfer tokens cross-chain using CCIP.
     * @param destChainId The id of the chain where tokens are to be transferred to.
     * @param amount The amount of tokens to be transferred, denominated with 18 decimals of precision.
     * @return gasTokenUsed The amount of fees paid in the cross-chain transfer, denominated with 18 decimals of precision.
     */
    function transferCrossChain(
        uint64 destChainId,
        uint256 amount
    ) external payable returns (uint256 gasTokenUsed);
}
