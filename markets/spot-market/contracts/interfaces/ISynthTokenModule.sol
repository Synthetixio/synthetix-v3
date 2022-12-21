//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// solhint-disable-next-line no-empty-blocks
interface ISynthTokenModule {
    function setInterestRate(uint256 newInterestRate) external;
}
