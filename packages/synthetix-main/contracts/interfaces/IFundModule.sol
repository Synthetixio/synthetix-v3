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
        uint[] calldata weights,
        int[] calldata maxDebtShareValues
    ) external;

    /// @notice gets the fund positions
    function getFundPosition(uint fundId)
        external
        view
        returns (
            uint[] memory markets,
            uint[] memory weights,
            int[] memory maxDebtShareValues
        );

    /// @notice sets the fund name
    function setFundName(uint fundId, string memory name) external;

    /// @notice gets the fund name
    function getFundName(uint fundId) external view returns (string memory fundName);

    /// @notice nominates a new fund owner
    function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external;

    /// @notice accepts ownership by nominated owner
    function acceptFundOwnership(uint256 fundId) external;

    /// @notice renounces ownership by nominated owner
    function renounceFundNomination(uint256 fundId) external;

    /// @notice gets owner of fundId
    function ownerOf(uint256 fundId) external view returns (address);

    /// @notice gets nominatedOwner of fundId
    function nominatedOwnerOf(uint256 fundId) external view returns (address);

    /// @notice places a cap on what proportion of free vault liquidity may be used towards a fund. only owner.
    function setMinLiquidityRatio(uint minLiquidityRatio) external;

    /// @notice returns the liquidity ratio cap for delegation of liquidity by funds to markets
    function getMinLiquidityRatio() external view returns (uint);
}
