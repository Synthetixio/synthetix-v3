//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing pool token and pools positions distribution
interface IPoolModule {
    /// @notice creates a new poolToken (NFT)
    function createPool(uint requestedPoolId, address owner) external;

    /// @notice sets the pool positions (only poolToken owner)
    function setPoolPosition(
        uint poolId,
        uint[] calldata markets,
        uint[] calldata weights,
        int[] calldata maxDebtShareValues
    ) external;

    /// @notice gets the pool positions
    function getPoolPosition(uint poolId)
        external
        view
        returns (
            uint[] memory markets,
            uint[] memory weights,
            int[] memory maxDebtShareValues
        );

    /// @notice sets the pool name
    function setPoolName(uint poolId, string memory name) external;

    /// @notice gets the pool name
    function getPoolName(uint poolId) external view returns (string memory poolName);

    /// @notice nominates a new pool owner
    function nominateNewPoolOwner(address nominatedOwner, uint256 poolId) external;

    /// @notice accepts ownership by nominated owner
    function acceptPoolOwnership(uint256 poolId) external;

    /// @notice renounces ownership by nominated owner
    function renouncePoolNomination(uint256 poolId) external;

    /// @notice gets owner of poolId
    function ownerOf(uint256 poolId) external view returns (address);

    /// @notice gets nominatedOwner of poolId
    function nominatedOwnerOf(uint256 poolId) external view returns (address);

    /// @notice places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.
    function setMinLiquidityRatio(uint minLiquidityRatio) external;

    /// @notice returns the liquidity ratio cap for delegation of liquidity by pools to markets
    function getMinLiquidityRatio() external view returns (uint);
}
