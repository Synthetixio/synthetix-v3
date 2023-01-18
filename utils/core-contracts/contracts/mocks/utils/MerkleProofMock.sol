//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/MerkleProof.sol";

contract MerkleProofMock {
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) public pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }
}
