//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IElectionModule as IBaseElectionModule} from "@synthetixio/core-modules/contracts/interfaces/IElectionModule.sol";

interface ISynthetixElectionModule is IBaseElectionModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeSynthetixElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address debtShareContract
    ) external;

    function isSynthetixElectionModuleInitialized() external view returns (bool);

    // ---------------------------------------
    // L2 debt share
    // ---------------------------------------

    function setDebtShareContract(address newDebtShareContractAddress) external;

    function getDebtShareContract() external view returns (address);

    // ---------------------------------------
    // L1 debt share
    // ---------------------------------------

    function setL1DebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) external;

    function declareL1DebtShare(
        address account,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external;

    function getL1DebtShareMerkleRoot() external view returns (bytes32);

    function getL1DebtShareMerkleRootBlocknumber() external view returns (uint);

    function getL1DebtShare(address account) external view returns (uint);
}
