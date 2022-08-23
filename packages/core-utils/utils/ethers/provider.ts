import { ethers } from 'ethers';

/**
 * Manually parses raw event logs with the given contract interface
 * @param {contract} contract The contract to use for identifying the logs
 * @param {logs} logs An array of raw unparsed logs
 * @returns {array} The array of parsed events
 */
export async function getBlockTimestamp(
  provider: ethers.providers.Provider,
  block: ethers.providers.BlockTag | Promise<ethers.providers.BlockTag> = 'latest'
) {
  return (await provider.getBlock(block)).timestamp;
}
