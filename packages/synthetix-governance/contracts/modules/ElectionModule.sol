//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as BaseElectionModule} from "@synthetixio/core-modules/contracts/modules/ElectionModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/interfaces/IElectionModule.sol";
import "../interfaces/ISynthetixElectionModule.sol";
import "../submodules/election/DebtShareManager.sol";
import "../submodules/election/CrossChainDebtShareManager.sol";

/// @title Module for electing a council, represented by a set of NFT holders
contract ElectionModule is ISynthetixElectionModule, BaseElectionModule, DebtShareManager, CrossChainDebtShareManager {
    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address debtShareContract
    ) external onlyOwner onlyIfNotInitialized {
        _setDebtShareContract(debtShareContract);

        initializeElectionModule(
            councilTokenName,
            councilTokenSymbol,
            firstCouncil,
            minimumActiveMembers,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    function nominate() public override(BaseElectionModule, IElectionModule) onlyInPeriod(ElectionPeriod.Nomination) {
        _takeDebtShareSnapshotOnFirstNomination();

        super.nominate();
    }

    // ---------------------------------------
    // Debt shares
    // ---------------------------------------

    function setDebtShareContract(address debtShareContract)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Administration)
    {
        _setDebtShareContract(debtShareContract);

        emit DebtShareContractSet(debtShareContract);
    }

    function getDebtShareContract() external view override returns (address) {
        return address(_debtShareStore().debtShareContract);
    }

    function getDebtShare(address voter) external view override returns (uint) {
        return _getDebtShare(voter);
    }

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    function declareCrossChainDebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external override {
        _declareCrossChainDebtShare(voter, debtShare, merkleProof);

        emit CrossChainDebtShareDeclared(voter, debtShare);
    }

    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Nomination)
    {
        _setCrossChainDebtShareMerkleRoot(merkleRoot, blocknumber);

        emit CrossChainDebtShareMerkleRootSet(merkleRoot, blocknumber, _electionStore().currentEpochIndex);
    }

    function getCrossChainDebtShareMerkleRoot() external view override returns (bytes32) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.merkleRoot;
    }

    function getCrossChainDebtShareMerkleRootBlocknumber() external view override returns (uint) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.merkleRootBlocknumber;
    }

    function getCrossChainDebtShare(address voter) external view override returns (uint) {
        return _getCrossChainDebtShare(voter);
    }

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    function _getVotePower(address voter) internal view override returns (uint) {
        uint votePower = _getDebtShare(voter) + _getCrossChainDebtShare(voter);

        return MathUtil.sqrt(votePower);
    }
}
