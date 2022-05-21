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

    // ---------------------------------------
    // Debt shares
    // ---------------------------------------

    /// @notice Sets the Synthetix v2 DebtShare snapshot that determines vote power for this epoch
    function setDebtShareSnapshotId(uint128 snapshotId)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Nomination)
    {
        _setDebtShareSnapshotId(snapshotId);
    }

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
    function getDebtShare(address user) external view override returns (uint) {
        return _getDebtShare(user);
    }

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    /// @notice Allows users to declare their Synthetix v2 debt shares on other chains
    function declareCrossChainDebtShare(
        address user,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external override onlyInPeriod(ElectionPeriod.Vote) {
        _declareCrossChainDebtShare(user, debtShare, merkleProof);

        emit CrossChainDebtShareDeclared(user, debtShare);
    }

    /// @notice Allows the system owner to declare a merkle root for user debt shares on other chains for this epoch
    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Nomination)
    {
        _setCrossChainDebtShareMerkleRoot(merkleRoot, blocknumber);

        emit CrossChainDebtShareMerkleRootSet(merkleRoot, blocknumber, _getCurrentEpochIndex());
    }

    /// @notice Returns the current epoch's merkle root for user debt shares on other chains
    function getCrossChainDebtShareMerkleRoot() external view override returns (bytes32) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.merkleRoot;
    }

    /// @notice Returns the current epoch's merkle root block number
    function getCrossChainDebtShareMerkleRootBlocknumber() external view override returns (uint) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.merkleRootBlockNumber;
    }

    /// @notice Returns the Synthetix v2 debt shares for the provided address, at this epoch's snapshot, in other chains
    function getDeclaredCrossChainDebtShare(address user) external view override returns (uint) {
        return _getDeclaredCrossChainDebtShare(user);
    }

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    /// @dev Overrides the user's voting power by combining local chain debt share with debt shares in other chains, quadratically filtered
    function _getVotePower(address user) internal view override returns (uint) {
        uint votePower = _getDebtShare(user) + _getDeclaredCrossChainDebtShare(user);

        return MathUtil.sqrt(votePower);
    }

    function _createNewEpoch() internal virtual override {
        super._createNewEpoch();

        DebtShareStore storage store = _debtShareStore();

        store.debtShareIds.push();
        store.crossChainDebtShareData.push();
    }
}
