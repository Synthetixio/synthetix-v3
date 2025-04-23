//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// https://docs.synthetix.io/contracts/source/interfaces/istakingrewards
interface ITreasuryStakingRewards {
    function balanceOf(uint128 account) external view returns (uint256);
    function totalDeposited() external view returns (uint256);
    function deposit(uint128 account, uint256 amount) external;
}
