//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "@synthetixio/core-modules/contracts/submodules/election/ElectionBase.sol";
import "../../storage/DebtShareStorage.sol";

/// @dev Implements merkle-tree migration/declaration of debt shares on L1
contract DebtShareVotesL1 is ElectionBase, DebtShareStorage {
    function _setL1DebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) internal {
        L1DebtShareData storage l1DebtShareData = _debtShareStore().l1DebtShareDatas[_getCurrentEpochIndex()];

        if (l1DebtShareData.merkleRoot != 0) {
            revert MerkleRootAlreadySet();
        }

        l1DebtShareData.merkleRoot = merkleRoot;
        l1DebtShareData.merkleRootBlocknumber = blocknumber;
    }

    function _declareL1DebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) internal {
        L1DebtShareData storage l1DebtShareData = _debtShareStore().l1DebtShareDatas[_getCurrentEpochIndex()];

        if (l1DebtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        bytes32 leaf = keccak256(abi.encodePacked(voter, debtShare));

        if (!MerkleProof.verify(merkleProof, l1DebtShareData.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        l1DebtShareData.debtShares[voter] = debtShare;
    }

    function _getL1DebtShare(address voter) internal view returns (uint) {
        L1DebtShareData storage l1DebtShareData = _debtShareStore().l1DebtShareDatas[_getCurrentEpochIndex()];

        return l1DebtShareData.debtShares[voter];
    }

    function _getVotePowerL1(address voter) internal view returns (uint) {
        return _getL1DebtShare(voter);
    }
}
