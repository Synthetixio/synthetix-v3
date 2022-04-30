//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as BaseElectionModule} from "@synthetixio/core-modules/contracts/modules/ElectionModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/interfaces/IElectionModule.sol";
import "../interfaces/ISynthetixElectionModule.sol";
import "../submodules/election/DebtShareManager.sol";
import "../submodules/election/CrossChainDebtShareManager.sol";

/// @title Module for electing a council, represented by a set of NFT holders
/// @notice This extends the base ElectionModule by determining voting power by Synthetix v2 debt share
contract ElectionModule is ISynthetixElectionModule, BaseElectionModule, DebtShareManager, CrossChainDebtShareManager {
    /// @dev Overloads the BaseElectionModule initializer with an additional parameter for the debt share contract
    /// @dev The BaseElectionModule initializer should not be called, and this one must be called instead
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

    /// @notice Overrides the BaseElectionModule nominate function taking a debt share snapshot on the first nomination of an epoch
    /// @dev This contract's proxy needs to be white listed in the debt shares contract for it to be able to take snapshots
    function nominate() public override(BaseElectionModule, IElectionModule) onlyInPeriod(ElectionPeriod.Nomination) {
        _takeDebtShareSnapshotOnFirstNomination();

        super.nominate();
    }

    // ---------------------------------------
    // Debt shares
    // ---------------------------------------

    /// @notice Sets the Synthetix v2 DebtShare contract that determines vote power
    function setDebtShareContract(address debtShareContract)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Administration)
    {
        _setDebtShareContract(debtShareContract);

        emit DebtShareContractSet(debtShareContract);
    }

    /// @notice Returns the Synthetix v2 DebtShare contract that determines vote power
    function getDebtShareContract() external view override returns (address) {
        return address(_debtShareStore().debtShareContract);
    }

    /// @notice Returns the Synthetix v2 debt share for the provided address, at this epoch's snapshot
    function getDebtShare(address voter) external view override returns (uint) {
        return _getDebtShare(voter);
    }

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    /// @notice Allows users to declare their Synthetix v2 debt shares on other chains
    function declareCrossChainDebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external override {
        _declareCrossChainDebtShare(voter, debtShare, merkleProof);

        emit CrossChainDebtShareDeclared(voter, debtShare);
    }

    /// @notice Allows the system owner to declare a merkle root for user debt shares on other chains for this epoch
    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Nomination)
    {
        _setCrossChainDebtShareMerkleRoot(merkleRoot, blocknumber);

        emit CrossChainDebtShareMerkleRootSet(merkleRoot, blocknumber, _electionStore().currentEpochIndex);
    }

    /// @notice Returns the current epoch's merkle root for user debt shares on other chains
    function getCrossChainDebtShareMerkleRoot() external view override returns (bytes32) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.merkleRoot;
    }

    /// @notice Returns the current epoch's merkle root block number
    function getCrossChainDebtShareMerkleRootBlocknumber() external view override returns (uint) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.merkleRootBlocknumber;
    }

    /// @notice Returns the Synthetix v2 debt shares for the provided address, at this epoch's snapshot, in other chains
    function getCrossChainDebtShare(address voter) external view override returns (uint) {
        return _getCrossChainDebtShare(voter);
    }

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    /// @dev Overrides the user's voting power by combining local chain debt share with debt shares in other chains, quadratically filtered
    function _getVotePower(address voter) internal view override returns (uint) {
        uint votePower = _getDebtShare(voter) + _getCrossChainDebtShare(voter);

        return MathUtil.sqrt(votePower);
    }
}
