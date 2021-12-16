//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    function createMemberToken(string memory tokenName, string memory tokenSymbol) external;

    function upgradeMemberTokenImplementation(address newMemberTokenImplementation) external;

    function getMemberTokenAddress() external view returns (address);

    function setElectionTokenAddress(address addr) external;

    function getElectionTokenAddress() external view returns (address);

    function nominate() external;

    function withdrawNomination() external;

    function getMembers() external view returns (address[] memory);

    function getNominees() external view returns (address[] memory);

    function isElectionEvaluated() external view returns (bool);

    function evaluateElectionBatch() external;

    function resolveElection() external;

    function isEpochFinished() external view returns (bool);

    function isNominating() external view returns (bool);

    function isVoting() external view returns (bool);

    function getSeatCount() external view returns (uint);

    function getPeriodPercent() external view returns (uint);

    function setNextSeatCount(uint seats) external;

    function setNextEpochDuration(uint64 duration) external;

    function setNextPeriodPercent(uint8 percent) external;

    function getNextSeatCount() external view returns (uint);

    function elect(address[] memory numericallySortedCandidates, uint[] memory priorities) external;

    function getNextEpochDuration() external view returns (uint);

    function getNextPeriodPercent() external view returns (uint);

    function setupFirstEpoch() external;

    function setMaxProcessingBatchSize(uint size) external;

    function getMaxProcessingBatchSize() external view returns (uint);
}
