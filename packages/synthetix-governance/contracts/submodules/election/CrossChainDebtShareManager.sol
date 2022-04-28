//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "@synthetixio/core-modules/contracts/submodules/election/ElectionBase.sol";
import "../../storage/DebtShareStorage.sol";

/// @dev Allows tracking of debt shares on other chains
contract CrossChainDebtShareManager is ElectionBase, DebtShareStorage {
    function _setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) internal {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        if (debtShareData.merkleRoot != 0) {
            revert MerkleRootAlreadySet();
        }

        debtShareData.merkleRoot = merkleRoot;
        debtShareData.merkleRootBlocknumber = blocknumber;
    }

    function _declareCrossChainDebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) internal {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        bytes32 leaf = keccak256(abi.encodePacked(voter, debtShare));

        if (!MerkleProof.verify(merkleProof, debtShareData.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        debtShareData.debtShares[voter] = debtShare;
    }

    function _getCrossChainDebtShare(address voter) internal view returns (uint) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.debtShares[voter];
    }
}
