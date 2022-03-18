//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDebtShareMigrator {
    function setNewRoot(bytes32 merkleRoot) external;

    function migrateL1DebtShare(
        address account,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external;

    function getL1DebtShare(address account) external view returns (uint);
}
