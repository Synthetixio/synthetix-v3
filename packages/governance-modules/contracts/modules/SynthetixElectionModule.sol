//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/ElectionModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/interfaces/IElectionModule.sol";
import "../interfaces/ISynthetixElectionModule.sol";
import "../submodules/election/DebtShareVotesL1.sol";
import "../submodules/election/DebtShareVotesL2.sol";

/// @title Module for electing a council, represented by a set of NFT holders
contract SynthetixElectionModule is ISynthetixElectionModule, ElectionModule, DebtShareVotesL1, DebtShareVotesL2 {
    function initializeSynthetixElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address debtShareContract
    ) external override onlyOwner onlyIfNotInitialized {
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

    function isSynthetixElectionModuleInitialized() external view returns (bool) {
        return isElectionModuleInitialized();
    }

    // ---------------------------------------
    // L2 debt share
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

    function getDebtShareContract() external view returns (address) {
        return address(_debtShareStore().debtShareContract);
    }

    function nominate() public override(ElectionModule, IElectionModule) onlyInPeriod(ElectionPeriod.Nomination) {
        _takeDebtShareSnapshotOnFirstNomination();

        super.nominate();
    }

    // ---------------------------------------
    // L1 debt share
    // ---------------------------------------

    function setL1DebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Nomination)
    {
        _setL1DebtShareMerkleRoot(merkleRoot, blocknumber);

        emit L1DebtShareMerkleRootSet(merkleRoot, blocknumber, _electionStore().currentEpochIndex);
    }

    function declareL1DebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external override {
        _declareL1DebtShare(voter, debtShare, merkleProof);

        emit L1DebtShareDeclared(voter, debtShare);
    }

    function getL1DebtShareMerkleRoot() external view returns (bytes32) {
        L1DebtShareData storage l1DebtShareData = _debtShareStore().l1DebtShareDatas[_getCurrentEpochIndex()];

        return l1DebtShareData.merkleRoot;
    }

    function getL1DebtShareMerkleRootBlocknumber() external view returns (uint) {
        L1DebtShareData storage l1DebtShareData = _debtShareStore().l1DebtShareDatas[_getCurrentEpochIndex()];

        return l1DebtShareData.merkleRootBlocknumber;
    }

    function getL1DebtShare(address voter) external view returns (uint) {
        return _getL1DebtShare(voter);
    }

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    function _getVotePower(address voter) internal view override returns (uint) {
        uint votePower = _getVotePowerL1(voter) + _getVotePowerL2(voter);

        return MathUtil.sqrt(votePower);
    }
}
