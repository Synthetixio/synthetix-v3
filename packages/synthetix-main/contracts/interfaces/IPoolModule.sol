//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/MarketConfiguration.sol";

/// @title Module for managing pool token and pools positions distribution
interface IPoolModule {
    event PoolCreated(uint128 indexed poolId, address indexed owner);
    event NominatedPoolOwner(uint128 indexed poolId, address indexed owner);
    event PoolOwnershipAccepted(uint128 indexed poolId, address indexed owner);
    event PoolNominationRenounced(uint128 indexed poolId, address indexed owner);
    event PoolNominationRevoked(uint128 indexed poolId, address indexed owner);
    event PoolOwnershipRenounced(uint128 indexed poolId, address indexed owner);
    event PoolNameUpdated(uint128 indexed poolId, string indexed name, address indexed sender);
    event PoolConfigurationSet(uint128 indexed poolId, MarketConfiguration.Data[] markets, address indexed sender);

    /// @notice creates a new pool
    function createPool(uint128 requestedPoolId, address owner) external;

    /// @notice sets the pool positions (only poolToken owner)
    function setPoolConfiguration(uint128 poolId, MarketConfiguration.Data[] memory marketDistribution) external;

    /// @notice gets the pool positions
    function getPoolConfiguration(uint128 poolId) external view returns (MarketConfiguration.Data[] memory markets);

    /// @notice sets the pool name
    function setPoolName(uint128 poolId, string memory name) external;

    /// @notice gets the pool name
    function getPoolName(uint128 poolId) external view returns (string memory poolName);

    /// @notice nominates a new pool owner
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external;

    /// @notice accepts ownership by nominated owner
    function acceptPoolOwnership(uint128 poolId) external;

    /// @notice renounces nomination by nominated owner
    function renouncePoolNomination(uint128 poolId) external;

    /// @notice renounces ownership by owner
    function renouncePoolOwnership(uint128 poolId) external;

    /// @notice revokes pool nomination
    function revokePoolNomination(uint128 poolId) external;

    /// @notice gets owner of poolId
    function getPoolOwner(uint128 poolId) external view returns (address);

    /// @notice gets nominatedOwner of poolId
    function getNominatedPoolOwner(uint128 poolId) external view returns (address);

    /// @notice places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.
    function setMinLiquidityRatio(uint minLiquidityRatio) external;

    /// @notice returns the liquidity ratio cap for delegation of liquidity by pools to markets
    function getMinLiquidityRatio() external view returns (uint);
}
