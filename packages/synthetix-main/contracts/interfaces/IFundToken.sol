//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundToken {
    function mint(address owner, uint requestedFundId) external;

    function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external;

    function acceptFundOwnership(uint256 fundId) external;

    function renounceFundNomination(uint256 fundId) external;
}
