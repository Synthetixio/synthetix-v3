//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as BaseElectionModule} from "@synthetixio/core-modules/contracts/modules/ElectionModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "../submodules/election/DebtShareVotes.sol";
import "../interfaces/ISynthetixElectionModule.sol";

/// @title Module for electing a council, represented by a set of NFT holders
contract ElectionModule is ISynthetixElectionModule, BaseElectionModule, DebtShareVotes {
    function setDebtShareContract(address debtShareContract) external onlyOwner {
        _setDebtShareContract(debtShareContract);

        emit DebtShareContractSet(debtShareContract);
    }

    function setL1DebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) external {
        _setL1DebtShareMerkleRoot(merkleRoot, blocknumber);

        emit L1DebtShareMerkleRootSet(merkleRoot, blocknumber, _electionStore().currentEpochIndex);
    }

    function declareL1DebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) external {
        _declareL1DebtShare(voter, debtShare, merkleProof);

        emit L1DebtShareDeclared(voter, debtShare);
    }

    function getDebtShareContract() external view returns (address) {
        return address(_debtShareStore().debtShareContract);
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

    function _getVotePower(address voter) internal override view returns (uint) {
        uint votePower = _getVotePowerL1(voter) + _getVotePowerL2(voter);

        return MathUtil.sqrt(votePower);
    }
}
