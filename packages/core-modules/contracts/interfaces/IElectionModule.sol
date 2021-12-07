//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    function createMemberToken(string memory tokenName, string memory tokenSymbol) external;

    function upgradeMemberTokenImplementation(address newMemberTokenImplementation) external;

    function getMemberTokenAddress() external view returns (address);

    function setElectionTokenAddress(address addr) external;

    function getElectionTokenAddress() external view returns (address);

    function getNominees() external view returns (address[] memory);

    function nominate() external;

    function withdrawNomination() external;

    function setSeatCount(uint seats) external;

    function setPeriodPercent(uint8 percent) external;

    function setNextSeatCount(uint seats) external;

    function setNextEpochDuration(uint64 duration) external;

    function setNextPeriodPercent(uint8 percent) external;

    function elect(address[] memory candidates) external;

    function getNomineeVotes(address nominee) external view returns (uint);

    function isEpochFinished() external view returns (bool);

    function isNominating() external view returns (bool);

    function isVoting() external view returns (bool);

    function setupFirstEpoch() external;
}
