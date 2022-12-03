//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/MarketConfiguration.sol";

/// @title Module for managing pool token and pools positions distribution
interface IPoolModule {
    /// @notice gets fired when pool will be created
    event PoolCreated(uint128 indexed poolId, address indexed owner, address indexed sender);
    /// @notice gets fired when pool owner proposes a new owner
    event PoolOwnerNominated(uint128 indexed poolId, address indexed nominatedOwner, address indexed owner);
    /// @notice gets fired when pool nominee accepts nomination
    event PoolOwnershipAccepted(uint128 indexed poolId, address indexed owner);
    /// @notice gets fired when pool owner revokes nonimation
    event PoolNominationRevoked(uint128 indexed poolId, address indexed owner);
    /// @notice gets fired when pool nominee renounces nomination
    event PoolNominationRenounced(uint128 indexed poolId, address indexed owner);
    /// @notice gets fired when pool name changes
    event PoolNameUpdated(uint128 indexed poolId, string indexed name, address indexed sender);
    /// @notice gets fired when pool gets configured
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

    /// @notice revokes nomination by pool owner
    function revokePoolNomination(uint128 poolId) external;

    /// @notice renounce nomination by nominee
    function renouncePoolNomination(uint128 poolId) external;

    /// @notice gets owner of poolId
    function getPoolOwner(uint128 poolId) external view returns (address);

    /// @notice gets nominatedOwner of poolId
    function getNominatedPoolOwner(uint128 poolId) external view returns (address);

    /// @notice places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.
    function setMinLiquidityRatio(uint minLiquidityRatio) external;

    /// @notice returns the liquidity ratio cap for delegation of liquidity by pools to markets
    function getMinLiquidityRatio() external view returns (uint);
}
