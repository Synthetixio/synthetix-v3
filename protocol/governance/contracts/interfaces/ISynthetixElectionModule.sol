//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IElectionModule as IBaseElectionModule} from "./IElectionModule.sol";

interface ISynthetixElectionModule is IBaseElectionModule {
    /// @notice Initializes the module and immediately starts the first epoch
    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
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
    function setDebtShareSnapshotId(uint256 snapshotId) external;

    /// @notice Returns the Synthetix v2 DebtShare snapshot id set for this epoch
    function getDebtShareSnapshotId() external view returns (uint256);

    /// @notice Returns the Synthetix v2 debt share for the provided address, at this epoch's snapshot
    function getDebtShare(address user) external view returns (uint256);

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    /// @notice Allows the system owner to declare a merkle root for user debt shares on other chains for this epoch
    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint256 blocknumber) external;

    /// @notice Returns the current epoch's merkle root for user debt shares on other chains
    function getCrossChainDebtShareMerkleRoot() external view returns (bytes32);

    /// @notice Returns the current epoch's merkle root block number
    function getCrossChainDebtShareMerkleRootBlockNumber() external view returns (uint256);

    /// @notice Allows users to declare their Synthetix v2 debt shares on other chains
    function declareCrossChainDebtShare(
        address account,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external;

    /// @notice Returns the Synthetix v2 debt shares for the provided address, at this epoch's snapshot, in other chains
    function getDeclaredCrossChainDebtShare(address account) external view returns (uint256);

    /// @notice Declares cross chain debt shares and casts a vote
    function declareAndCast(
        uint256 debtShare,
        bytes32[] calldata merkleProof,
        address[] calldata candidates
    ) external;
}
