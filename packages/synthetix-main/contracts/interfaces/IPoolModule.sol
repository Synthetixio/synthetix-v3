//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/MarketConfiguration.sol";

/**
 * @title Module for the creation and management of pools.
 * @dev The pool owner can be specified during creation, can be transferred, and has credentials for configuring the pool.
 */
interface IPoolModule {
    /**
     * @notice Gets fired when pool will be created.
     */
    event PoolCreated(uint128 indexed poolId, address indexed owner, address indexed sender);

    /**
     * @notice Gets fired when pool owner proposes a new owner.
     */
    event PoolOwnerNominated(uint128 indexed poolId, address indexed nominatedOwner, address indexed owner);

    /**
     * @notice Gets fired when pool nominee accepts nomination.
     */
    event PoolOwnershipAccepted(uint128 indexed poolId, address indexed owner);

    /**
     * @notice Gets fired when pool owner revokes nomination.
     */
    event PoolNominationRevoked(uint128 indexed poolId, address indexed owner);

    /**
     * @notice Gets fired when pool nominee renounces nomination.
     */
    event PoolNominationRenounced(uint128 indexed poolId, address indexed owner);

    /**
     * @notice Gets fired when pool name changes.
     */
    event PoolNameUpdated(uint128 indexed poolId, string indexed name, address indexed sender);

    /**
     * @notice Gets fired when pool gets configured.
     */
    event PoolConfigurationSet(uint128 indexed poolId, MarketConfiguration.Data[] markets, address indexed sender);

    /**
     * @notice Creates a pool with the requested pool id.
     */
    function createPool(uint128 requestedPoolId, address owner) external;

    /**
     * @notice Allows the pool owner to configure the pool.
     * @dev The pool's configuration is composed of an array of MarketConfiguration objects, which describe which markets the pool provides liquidity to, in what proportion, and to what extent.
     * @dev Incoming market ids need to be provided in ascending order.
     */
    function setPoolConfiguration(uint128 poolId, MarketConfiguration.Data[] memory marketDistribution) external;

    /**
     * @notice Retrieves the MarketConfiguration of the specified pool.
     */
    function getPoolConfiguration(uint128 poolId) external view returns (MarketConfiguration.Data[] memory markets);

    /**
     * @notice Allows the owner of the pool to set the pool's name.
     */
    function setPoolName(uint128 poolId, string memory name) external;

    /**
     * @notice Returns the pool's name.
     */
    function getPoolName(uint128 poolId) external view returns (string memory poolName);

    /**
     * @notice Allows the current pool owner to nominate a new owner.
     */
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external;

    /**
     * @notice After a new pool owner has been nominated, allows it to accept the nomination and thus ownership of the pool.
     */
    function acceptPoolOwnership(uint128 poolId) external;

    /**
     * @notice After a new pool owner has been nominated, allows it to reject the nomination.
     */
    function revokePoolNomination(uint128 poolId) external;

    /**
     * @notice Allows the current nominated owner to renounce the nomination.
     */
    function renouncePoolNomination(uint128 poolId) external;

    /**
     * @notice Returns the current pool owner.
     */
    function getPoolOwner(uint128 poolId) external view returns (address);

    /**
     * @notice Returns the current nominated pool owner.
     */
    function getNominatedPoolOwner(uint128 poolId) external view returns (address);

    /**
     * @notice Allows the system owner (not the pool owner) to set the system-wide minimum liquidity ratio.
     */
    function setMinLiquidityRatio(uint minLiquidityRatio) external;

    /**
     * @notice Retrieves the system-wide minimum liquidity ratio.
     */
    function getMinLiquidityRatio() external view returns (uint);
}
