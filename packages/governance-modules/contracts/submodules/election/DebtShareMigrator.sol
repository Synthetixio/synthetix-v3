//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-modules/contracts/submodules/election/ElectionBase.sol";
import "../interfaces/IDebtShare.sol";
import "../interfaces/IDebtShareMigrator.sol";
import "../storage/DebtShareMigratorStorage.sol";

contract DebtShareMigrator is ElectionBase, IDebtShareMigrator, DebtShareMigratorStorage, OwnableMixin {
    event MerkleRootSet(bytes32 merkleRoot);
    event DebtShareMigrated(address voter, uint debtShare);

    error MerkleRootNotSet();
    error MerkleRootAlreadySet();
    error InvalidMerkleProof();

    function setNewRoot(bytes32 merkleRoot) external override onlyOwner {
        DebtShareMigratorStore storage store = _debtShareMigratorStore();

        uint currentPeriodIndex = _electionStore().currentEpochIndex;

        // store.currentEpochIndex = index;
        if (store.epochs[currentPeriodIndex].merkleroot != 0) {
            revert MerkleRootAlreadySet();
        }

        store.epochs[currentPeriodIndex].merkleroot = merkleRoot;

        emit MerkleRootSet(merkleRoot);
    }

    function migrateL1DebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external override {
        DebtShareMigratorStore storage store = _debtShareMigratorStore();

        uint currentPeriodIndex = _electionStore().currentEpochIndex;

        // store.currentEpochIndex = index;
        if (store.epochs[currentPeriodIndex].merkleroot == 0) {
            revert MerkleRootNotSet();
        }

        // build leaf
        bytes32 leaf = keccak256(abi.encodePacked(voter, debtShare));

        if (!MerkleProof.verify(merkleProof, store.epochs[currentPeriodIndex].merkleroot, leaf)) {
            revert InvalidMerkleProof();
        }

        store.epochs[currentPeriodIndex].l1debtshares[voter] = debtShare;

        emit DebtShareMigrated(voter, debtShare);
    }

    function getL1DebtShare(address voter) public view override returns (uint) {
        uint currentPeriodIndex = _electionStore().currentEpochIndex;
        return _debtShareMigratorStore().epochs[currentPeriodIndex].l1debtshares[voter];
    }
}
