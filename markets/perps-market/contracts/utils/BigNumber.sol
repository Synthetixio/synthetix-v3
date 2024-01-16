//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Interest Rate
 */
library BigNumber {
    uint256 constant CHUNK_SIZE = 2 ** 255;

    struct Data {
        /**
         * @dev Market interest rates
         */
        uint256[] chunks;
    }

    struct Snapshot {
        uint256 currentChunkId;
        uint256 valueAtChunk;
    }

    // Take a snapshot of the current BigNumber value
    function takeSnapshot(Data storage number) internal view returns (Snapshot memory) {
        // Assume the last chunk has the latest change
        uint256 lastChunkId = number.chunks.length - 1;
        return Snapshot({currentChunkId: lastChunkId, valueAtChunk: number.chunks[lastChunkId]});
    }

    function add(Data storage number, uint256 amount) internal {
        uint256 carry = amount;
        uint256 i = 0;
        while (carry > 0) {
            if (i == number.chunks.length) {
                number.chunks.push(0);
            }

            uint256 newChunkValue = number.chunks[i];
            uint256 spaceInChunk = CHUNK_SIZE - newChunkValue;

            if (carry < spaceInChunk) {
                newChunkValue += carry;
                carry = 0;
            } else {
                newChunkValue = CHUNK_SIZE;
                carry -= spaceInChunk;
            }

            number.chunks[i] = newChunkValue;
            ++i;
        }
    }
}
