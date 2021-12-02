//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    error MemberTokenAlreadyCreated();

    error AlreadyNominated(address addr);
    error NotNominated(address addr);

    event MemberTokenCreated(address memberTokenAddress);

    function createMemberToken(string memory tokenName, string memory tokenSymbol) external;

    function upgradeMemberTokenImplementation(address newMemberTokenImplementation) external;

    function getMemberTokenAddress() external view returns (address);

    function getNominees() external view returns (address[] memory);

    function selfNominate() external;

    function selfUnnominate() external;
}
