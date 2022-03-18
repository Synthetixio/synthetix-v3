//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISpartanCouncil {
    function setDebtShareContract(address newDebtShareContractAddress) external;

    function getDebtShareContract() external view returns (address);
}
