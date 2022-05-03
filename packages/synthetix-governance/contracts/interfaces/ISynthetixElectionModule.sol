//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IElectionModule as IBaseElectionModule} from "@synthetixio/core-modules/contracts/interfaces/IElectionModule.sol";

interface ISynthetixElectionModule is IBaseElectionModule {
    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
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

    function setDebtShareContract(address newDebtShareContractAddress) external;

    function getDebtShareContract() external view returns (address);

    function getDebtShare(address user) external view returns (uint);

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) external;

    function declareCrossChainDebtShare(
        address account,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external;

    function getCrossChainDebtShareMerkleRoot() external view returns (bytes32);

    function getCrossChainDebtShareMerkleRootBlocknumber() external view returns (uint);

    function getCrossChainDebtShare(address account) external view returns (uint);
}
