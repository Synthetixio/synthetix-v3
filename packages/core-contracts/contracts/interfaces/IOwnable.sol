//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOwnable {
    function acceptOwnership() external;

    function nominateNewOwner(address newNominatedOwner) external;

    function renounceNomination() external;

    function owner() external view returns (address);

    function nominatedOwner() external view returns (address);
}
