//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    function createMemberToken(string memory tokenName, string memory tokenSymbol) external;

    function upgradeMemberTokenImplementation(address newMemberTokenImplementation) external;

    function getMemberTokenAddress() external view returns (address);

    function getNominees() external view returns (address[] memory);

    function nominate() external;

    function withdrawNomination() external;

    function setSeatCount(uint seats) external;

    function setNextSeatCount(uint seats) external;

    function setEpochDuration(uint duration) external;

    function setNextEpochDuration(uint duration) external;

    function setPeriodPercent(uint8 percent) external;

    function setNextPeriodPercent(uint8 percent) external;
}
