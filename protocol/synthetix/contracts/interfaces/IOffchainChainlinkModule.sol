//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/FunctionsClientInterface.sol";

/**
 * @title Module with assorted utility functions.
 */
interface IOffchainChainlinkModule is FunctionsClientInterface {
    /**
     * @notice Allows for owner to set information for cross chain protocols with Chainlink CCIP
     * @param ccipRouter The address of the CCIP Router contract
     * @param ccipTokenPool The address of the CCIP Token Pool contract
     * @param chainlinkFunctions The address of the offchain read contract for Chainlink CCIP
     * @param supportedNetworks The list of supported chain ids for the cross chain protocol
     * @param ccipSelectors Mapping of selectors used for chainlink related to the supportedNetworks
     */
    function configureChainlinkCrossChain(
        address ccipRouter,
        address ccipTokenPool,
        address chainlinkFunctions,
        uint64[] memory supportedNetworks,
        uint64[] memory ccipSelectors
    ) external;
}
