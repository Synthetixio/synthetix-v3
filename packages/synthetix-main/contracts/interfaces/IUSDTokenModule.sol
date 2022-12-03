//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/**
 * @title Module for managing the snxUSD token as an associated system.
 */
interface IUSDTokenModule is ITokenModule {
    /**
     * @notice Allows the core system to burn stablecoins with transfer allowance.
     */
    function burnWithAllowance(
        address from,
        address spender,
        uint amount
    ) external;

    /**
     * @notice Allows users to transfer tokens cross-chain using CCIP. This is disabled until _CCIP_CHAINLINK_SEND is set in UtilsModule. This is currently included for testing purposes. Functionality will change, including fee collection, as CCIP continues development.
     */
    function transferCrossChain(
        uint destChainId,
        address,
        uint amount
    ) external returns (uint feesPaid);
}
