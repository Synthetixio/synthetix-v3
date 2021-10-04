//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IOwnable {
    event OwnerNominated(address newOwner);
    event OwnerChanged(address oldOwner, address newOwner);

    function acceptOwnership() external;

    function nominateNewOwner(address newOwner) external;

    function renounceNomination() external;

    function owner() external view returns (address);

    function nominatedOwner() external view returns (address);
}
