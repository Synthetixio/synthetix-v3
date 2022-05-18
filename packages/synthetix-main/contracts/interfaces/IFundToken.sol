//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundToken {
    function mint(address owner, uint requestedFundId) external;

    function nominateNewOwner(address nominatedOwner, uint256 fundId) external;

    function acceptOwnership(uint256 fundId) external;

    function renounceNomination(uint256 fundId) external;
}
