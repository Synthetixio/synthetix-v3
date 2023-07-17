//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IElectionModule as IBaseElectionModule} from "./IElectionModule.sol";

interface ISynthetixElectionModule is IBaseElectionModule {
    /// @notice Initializes the module and immediately starts the first epoch
    /// @param firstCouncil council members for the council on the first epoch
    /// @param minimumActiveMembers Minimum active council members. If too many are dismissed an emergency election is triggered
    /// @param epochSeatCount Amount of council members to be elected on the first epoch
    /// @param nominationPeriodStartDate Date timestamp when the first epoch is going to start
    /// @param votingPeriodDuration Duration in days of voting period
    /// @param epochDuration Duration in days of the entire epoch
    /// @param debtShareContract Synthetix v2 DebtShare contract that determines vote power
    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint8 epochSeatCount,
        uint64 nominationPeriodStartDate,
        uint16 votingPeriodDuration,
        uint16 epochDuration,
        address debtShareContract
    ) external;

    // ---------------------------------------
    // Debt shares
    // ---------------------------------------

    /// @notice Sets the Synthetix v2 DebtShare contract that determines vote power
    function setDebtShareContract(address newDebtShareContractAddress) external;

    /// @notice Returns the Synthetix v2 DebtShare contract that determines vote power
    function getDebtShareContract() external view returns (address);

    /// @notice Sets the Synthetix v2 DebtShare snapshot that determines vote power for this epoch
    function setDebtShareSnapshotId(uint snapshotId) external;

    /// @notice Returns the Synthetix v2 DebtShare snapshot id set for this epoch
    function getDebtShareSnapshotId() external view returns (uint);

    /// @notice Returns the Synthetix v2 debt share for the provided address, at this epoch's snapshot
    function getDebtShare(address user) external view returns (uint);

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    /// @notice Allows the system owner to declare a merkle root for user debt shares on other chains for this epoch
    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) external;

    /// @notice Returns the current epoch's merkle root for user debt shares on other chains
    function getCrossChainDebtShareMerkleRoot() external view returns (bytes32);

    /// @notice Returns the current epoch's merkle root block number
    function getCrossChainDebtShareMerkleRootBlockNumber() external view returns (uint);

    /// @notice Allows users to declare their Synthetix v2 debt shares on other chains
    function declareCrossChainDebtShare(
        address account,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external;

    /// @notice Returns the Synthetix v2 debt shares for the provided address, at this epoch's snapshot, in other chains
    function getDeclaredCrossChainDebtShare(address account) external view returns (uint);

    /// @notice Declares cross chain debt shares and casts a vote
    function declareAndCast(
        uint256 debtShare,
        bytes32[] calldata merkleProof,
        address[] calldata candidates
    ) external;
}
