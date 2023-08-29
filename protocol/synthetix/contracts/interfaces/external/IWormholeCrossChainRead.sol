// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

/**
 * @title Interface for cross chain communication with wormhole
 * @notice Though its not shown here, wormhole would use some sort of a client-side message
 * revealing, such as EIP7412. Obviously it is not possible to simply call a function and receive cross chain data (lol)
 */
interface IWormholeCrossChainRead {
		function getCrossChainData(uint16 chainId, address targetAddress, bytes memory data) external returns (bytes memory);
}
