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

    function getCandidates() external view returns (address[] memory);

    function elect(address[] memory candidates) external;

    function isElectionEvaluated() external view returns (bool);

    function evaluateElectionBatch() external;

    function setMaxProcessingBatchSize(uint size) external;

    function getMaxProcessingBatchSize() external view returns (uint);

    function resolveElection() external;

    function isEpochFinished() external view returns (bool);

    function isNominating() external view returns (bool);

    function isVoting() external view returns (bool);

    function setNextSeatCount(uint seats) external;

    function setNextEpochDuration(uint64 duration) external;

    function setNextPeriodPercent(uint8 percent) external;

    function getSeatCount() external view returns (uint);

    function getEpochDuration() external view returns (uint);

    function getPeriodPercent() external view returns (uint);

    function getNextSeatCount() external view returns (uint);

    function getNextEpochDuration() external view returns (uint);

    function getNextPeriodPercent() external view returns (uint);

    function setupFirstEpoch() external;
}
