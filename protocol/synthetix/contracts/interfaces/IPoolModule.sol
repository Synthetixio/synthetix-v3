//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/MarketConfiguration.sol";

/**
 * @title Module for the creation and management of pools.
 * @dev The pool owner can be specified during creation, can be transferred, and has credentials for configuring the pool.
 */
interface IPoolModule {
    /**
     * @notice Thrown when attempting to disconnect a market whose capacity is locked, and whose removal would cause a decrease in its associated pool's credit delegation proportion.
     */
    error CapacityLocked(uint256 marketId);

    /**
     * @notice Gets fired when pool will be created.
     * @param poolId The id of the newly created pool.
     * @param owner The owner of the newly created pool.
     * @param sender The address that triggered the creation of the pool.
     */
    event PoolCreated(uint128 indexed poolId, address indexed owner, address indexed sender);

    /**
     * @notice Gets fired when pool owner proposes a new owner.
     * @param poolId The id of the pool for which the nomination ocurred.
     * @param nominatedOwner The address that was nominated as the new owner of the pool.
     * @param owner The address of the current owner of the pool.
     */
    event PoolOwnerNominated(
        uint128 indexed poolId,
        address indexed nominatedOwner,
        address indexed owner
    );

    /**
     * @notice Gets fired when pool nominee accepts nomination.
     * @param poolId The id of the pool for which the owner nomination was accepted.
     * @param owner The address of the new owner of the pool, which accepted the nomination.
     */
    event PoolOwnershipAccepted(uint128 indexed poolId, address indexed owner);

    /**
     * @notice Gets fired when pool owner revokes nomination.
     * @param poolId The id of the pool in which the nomination was revoked.
     * @param owner The current owner of the pool.
     */
    event PoolNominationRevoked(uint128 indexed poolId, address indexed owner);

    /**
     * @notice Gets fired when pool nominee renounces nomination.
     * @param poolId The id of the pool for which the owner nomination was renounced.
     * @param owner The current owner of the pool.
     */
    event PoolNominationRenounced(uint128 indexed poolId, address indexed owner);

    /**
     * @notice Gets fired when pool name changes.
     * @param poolId The id of the pool whose name was updated.
     * @param name The new name of the pool.
     * @param sender The address that triggered the rename of the pool.
     */
    event PoolNameUpdated(uint128 indexed poolId, string name, address indexed sender);

    /**
     * @notice Gets fired when pool gets configured.
     * @param poolId The id of the pool whose configuration was set.
     * @param markets Array of configuration data of the markets that were connected to the pool.
     * @param sender The address that triggered the pool configuration.
     */
    event PoolConfigurationSet(
        uint128 indexed poolId,
        MarketConfiguration.Data[] markets,
        address indexed sender
    );

    /**
     * @notice Creates a pool with the requested pool id.
     * @param requestedPoolId The requested id for the new pool. Reverts if the id is not available.
     * @param owner The address that will own the newly created pool.
     */
    function createPool(uint128 requestedPoolId, address owner) external;

    /**
     * @notice Allows the pool owner to configure the pool.
     * @dev The pool's configuration is composed of an array of MarketConfiguration objects, which describe which markets the pool provides liquidity to, in what proportion, and to what extent.
     * @dev Incoming market ids need to be provided in ascending order.
     * @param poolId The id of the pool whose configuration is being set.
     * @param marketDistribution The array of market configuration objects that define the list of markets that are connected to the system.
     */
    function setPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[] memory marketDistribution
    ) external;

    /**
     * @notice Retrieves the MarketConfiguration of the specified pool.
     * @param poolId The id of the pool whose configuration is being queried.
     * @return markets The array of MarketConfiguration objects that describe the pool's configuration.
     */
    function getPoolConfiguration(
        uint128 poolId
    ) external view returns (MarketConfiguration.Data[] memory markets);

    /**
     * @notice Allows the owner of the pool to set the pool's name.
     * @param poolId The id of the pool whose name is being set.
     * @param name The new name to give to the pool.
     */
    function setPoolName(uint128 poolId, string memory name) external;

    /**
     * @notice Returns the pool's name.
     * @param poolId The id of the pool whose name is being queried.
     * @return poolName The current name of the pool.
     */
    function getPoolName(uint128 poolId) external view returns (string memory poolName);

    /**
     * @notice Allows the current pool owner to nominate a new owner.
     * @param nominatedOwner The address to nominate os the new pool owner.
     * @param poolId The id whose ownership is being transferred.
     */
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external;

    /**
     * @notice After a new pool owner has been nominated, allows it to accept the nomination and thus ownership of the pool.
     * @param poolId The id of the pool for which the caller is to accept ownership.
     */
    function acceptPoolOwnership(uint128 poolId) external;

    /**
     * @notice After a new pool owner has been nominated, allows it to reject the nomination.
     * @param poolId The id of the pool for which the new owner nomination is to be revoked.
     */
    function revokePoolNomination(uint128 poolId) external;

    /**
     * @notice Allows the current nominated owner to renounce the nomination.
     * @param poolId The id of the pool for which the caller is renouncing ownership nomination.
     */
    function renouncePoolNomination(uint128 poolId) external;

    /**
     * @notice Returns the current pool owner.
     * @param poolId The id of the pool whose ownership is being queried.
     * @return owner The current owner of the pool.
     */
    function getPoolOwner(uint128 poolId) external view returns (address owner);

    /**
     * @notice Returns the current nominated pool owner.
     * @param poolId The id of the pool whose nominated owner is being queried.
     * @return nominatedOwner The current nominated owner of the pool.
     */
    function getNominatedPoolOwner(uint128 poolId) external view returns (address nominatedOwner);

    /**
     * @notice Allows the system owner (not the pool owner) to set the system-wide minimum liquidity ratio.
     * @param minLiquidityRatio The new system-wide minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)
     */
    function setMinLiquidityRatio(uint256 minLiquidityRatio) external;

    /**
     * @notice Retrieves the system-wide minimum liquidity ratio.
     * @return minRatioD18 The current system-wide minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)
     */
    function getMinLiquidityRatio() external view returns (uint256 minRatioD18);
}
