//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "./ElectionBase.sol";
import "../../storage/DebtShare.sol";

/// @dev Uses a merkle tree to track user Synthetix v2 debt shares on other chains at a particular block number
contract CrossChainDebtShareManager is ElectionBase {
    error MerkleRootNotSet();
    error InvalidMerkleProof();
    error CrossChainDebtShareAlreadyDeclared();

    event CrossChainDebtShareMerkleRootSet(bytes32 merkleRoot, uint blocknumber, uint epoch);
    event CrossChainDebtShareDeclared(address user, uint debtShare);

    function _setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) internal {
        DebtShare.Data storage store = DebtShare.load();
        uint lastElectionId = Council.load().lastElectionId;

        CrossChainDebtShare.Data storage debtShareData = store.crossChainDebtShareData[
            lastElectionId
        ];

        debtShareData.merkleRoot = merkleRoot;
        debtShareData.merkleRootBlockNumber = blocknumber;
    }

    function _declareCrossChainDebtShare(
        address user,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) internal {
        DebtShare.Data storage store = DebtShare.load();

        CrossChainDebtShare.Data storage debtShareData = store.crossChainDebtShareData[
            Council.load().lastElectionId
        ];

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        if (debtShareData.debtShares[user] != 0) {
            revert CrossChainDebtShareAlreadyDeclared();
        }

        bytes32 leaf = keccak256(abi.encodePacked(user, debtShare));

        if (!MerkleProof.verify(merkleProof, debtShareData.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        debtShareData.debtShares[user] = debtShare;
    }

    function _getCrossChainDebtShareMerkleRoot() internal view returns (bytes32) {
        DebtShare.Data storage store = DebtShare.load();

        CrossChainDebtShare.Data storage debtShareData = store.crossChainDebtShareData[
            Council.load().lastElectionId
        ];

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        return debtShareData.merkleRoot;
    }

    function _getCrossChainDebtShareMerkleRootBlockNumber() internal view returns (uint) {
        DebtShare.Data storage store = DebtShare.load();

        CrossChainDebtShare.Data storage debtShareData = store.crossChainDebtShareData[
            Council.load().lastElectionId
        ];

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        return debtShareData.merkleRootBlockNumber;
    }

    function _getDeclaredCrossChainDebtShare(address user) internal view returns (uint) {
        DebtShare.Data storage store = DebtShare.load();

        CrossChainDebtShare.Data storage debtShareData = store.crossChainDebtShareData[
            Council.load().lastElectionId
        ];

        return debtShareData.debtShares[user];
    }
}
