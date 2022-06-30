//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing fund token and funds positions distribution
interface IFundModule {
    /// @notice creates a new fundToken (NFT)
    function createFund(uint requestedFundId, address owner) external;

    /// @notice sets the fund positions (only fundToken owner)
    function setFundPosition(
        uint fundId,
        uint[] calldata markets,
        uint[] calldata weights
    ) external;

    /// @notice gets the fund positions
    function getFundPosition(uint fundId) external view returns (uint[] memory markets, uint[] memory weights);

    function setFundName(uint fundId, string memory name) external;

    function getFundName(uint fundId) external view returns (string memory fundName);

    function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external;

    function acceptFundOwnership(uint256 fundId) external;

    function renounceFundNomination(uint256 fundId) external;

    function ownerOf(uint256 fundId) external view returns (address);

    function nominatedOwnerOf(uint256 fundId) external view returns (address);
}
