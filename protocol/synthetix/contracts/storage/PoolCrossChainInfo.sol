//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./PoolCrossChainSync.sol";

library PoolCrossChainInfo {
    struct Data {
        /**
         * @notice Data from the latest sync round, which is used to override value within the pool when in cross chain mode
         */
        PoolCrossChainSync.Data latestSync;
        /**
         * @notice The total weight of all the tokens in the pool, including cross chain
         */
        uint128 latestTotalWeights;
        /**
         * @notice List of chain ids which this pool is connected to for cross chain synthesis
         */
        uint64[] pairedChains;
        /**
         * @notice Pool IDs of chains which pool is synthesized with
         */
        mapping(uint64 => uint128) pairedPoolIds;
        /**
         * @notice Generic ID used to authenticate requests for offchainreadSelector if the protocol requires it
         */
        bytes32 subscriptionId;
        /**
         * How frequently the data should be synced for this pool
         */
        uint256 subscriptionInterval;
        /**
         * @notice The ABI function to call to send messages to other chains
         */
        bytes4 broadcastSelector;
        /**
         * @notice The ABI function to call to read data from other chains (cross chain read)
         */
        bytes4 offchainReadSelector;
    }
}
