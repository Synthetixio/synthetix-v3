//SPDX-License-Identifier: UNLICENCED
pragma solidity ^0.8.0;

interface IOwnable {
    event OwnerNominated(address newOwner);
    event OwnerChanged(address oldOwner, address newOwner);

    function acceptOwnership() external;

    function nominateNewOwner(address newOwner) external;

    function renounceNomination() external;

    function getOwner() external view returns (address);

    function getNominatedOwner() external view returns (address);
}
