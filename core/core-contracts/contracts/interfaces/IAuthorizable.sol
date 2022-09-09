//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAuthorizable {
    function setNewAuthorized(address newNominatedOwner) external;

    function authorized() external view returns (address);
}
