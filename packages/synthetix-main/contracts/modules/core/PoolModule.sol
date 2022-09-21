//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../../interfaces/IPoolModule.sol";
import "../../storage/Pool.sol";

contract PoolModule is IPoolModule, OwnableMixin {
    error PoolAlreadyExists(uint128 poolId);
    error InvalidParameters(string incorrectParameter, string help);
    error PoolNotFound(uint128 poolId);

    using Pool for Pool.Data;
    using Market for Market.Data;

    modifier onlyPoolOwner(uint128 poolId, address requestor) {
        if (Pool.load(poolId).owner != requestor) {
            revert AccessError.Unauthorized(requestor);
        }

        _;
    }

    function createPool(uint128 requestedPoolId, address owner) external override {
        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        // todo
        if (Pool.load(requestedPoolId).exists() || requestedPoolId == 0) {
            revert PoolAlreadyExists(requestedPoolId);
        }

        Pool.create(requestedPoolId, owner);

        emit PoolCreated(requestedPoolId, owner);
    }

    // ---------------------------------------
    // Ownership
    // ---------------------------------------
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external override onlyPoolOwner(poolId, msg.sender) {
        Pool.load(poolId).nominatedOwner = nominatedOwner;

        emit NominatedPoolOwner(poolId, nominatedOwner);
    }

    function acceptPoolOwnership(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);
        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.owner = msg.sender;
        pool.nominatedOwner = address(0);

        emit PoolOwnershipAccepted(poolId, msg.sender);
    }

    function renouncePoolNomination(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);
        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.nominatedOwner = address(0);

        emit PoolNominationRenounced(poolId, msg.sender);
    }

    function getPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).owner;
    }

    function getNominatedPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).nominatedOwner;
    }

    function renouncePoolOwnership(uint128 poolId) external override onlyPoolOwner(poolId, msg.sender) {
        Pool.load(poolId).nominatedOwner = address(0);

        emit PoolOwnershipRenounced(poolId, msg.sender);
    }

    // ---------------------------------------
    // pool admin
    // ---------------------------------------
    function setPoolConfiguration(
        uint128 poolId,
        uint128[] calldata markets,
        uint[] calldata weights,
        int[] calldata maxDebtShareValues
    ) external override poolExists(poolId) onlyPoolOwner(poolId, msg.sender) {
        if (markets.length != weights.length || markets.length != maxDebtShareValues.length) {
            revert InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match");
        }

        // TODO: this is not super efficient. we only call this to gather the debt accumulated from deployed pools
        // would be better if we could eliminate the call at the end somehow
        Pool.Data storage pool = Pool.load(poolId);
        pool.distributeDebt();


        uint totalWeight = 0;
        uint i = 0;

        {
            uint lastMarketId = 0;

            for (
                ;
                i < (markets.length < pool.poolDistribution.length ? markets.length : pool.poolDistribution.length);
                i++
            ) {
                if (markets[i] <= lastMarketId) {
                    revert InvalidParameters("markets", "must be supplied in strictly ascending order");
                }
                lastMarketId = markets[i];

                MarketDistribution.Data storage distribution = pool.poolDistribution[i];
                distribution.market = markets[i];
                distribution.weight = uint128(weights[i]);
                distribution.maxDebtShareValue = int128(maxDebtShareValues[i]);

                totalWeight += weights[i];
            }

            for (; i < markets.length; i++) {
                if (markets[i] <= lastMarketId) {
                    revert InvalidParameters("markets", "must be supplied in strictly ascending order");
                }
                lastMarketId = markets[i];

                MarketDistribution.Data memory distribution;
                distribution.market = markets[i];
                distribution.weight = uint128(weights[i]);
                distribution.maxDebtShareValue = int128(maxDebtShareValues[i]);

                pool.poolDistribution.push(distribution);

                totalWeight += weights[i];
            }
        }

        uint popped = pool.poolDistribution.length - i;
        for (i = 0; i < popped; i++) {
            Market.load(pool.poolDistribution[pool.poolDistribution.length - 1].market).rebalance(poolId, 0, 0);
            pool.poolDistribution.pop();
        }

        pool.totalWeights = totalWeight;

        pool.rebalanceConfigurations();

        emit PoolConfigurationSet(poolId, markets, weights, msg.sender);
    }

    function getPoolConfiguration(uint128 poolId)
        external
        view
        override
        returns (
            uint[] memory,
            uint[] memory,
            int[] memory
        )
    {
        Pool.Data storage pool = Pool.load(poolId);

        uint[] memory markets = new uint[](pool.poolDistribution.length);
        uint[] memory weights = new uint[](pool.poolDistribution.length);
        int[] memory maxDebtShareValues = new int[](pool.poolDistribution.length);

        for (uint i = 0; i < pool.poolDistribution.length; i++) {
            markets[i] = pool.poolDistribution[i].market;
            weights[i] = pool.poolDistribution[i].weight;
            maxDebtShareValues[i] = pool.poolDistribution[i].maxDebtShareValue;
        }

        return (markets, weights, maxDebtShareValues);
    }

    function setPoolName(uint128 poolId, string memory name)
        external
        override
        poolExists(poolId)
        onlyPoolOwner(poolId, msg.sender)
    {
        Pool.load(poolId).name = name;

        emit PoolNameUpdated(poolId, name, msg.sender);
    }

    function getPoolName(uint128 poolId) external view override returns (string memory poolName) {
        return Pool.load(poolId).name;
    }

    // ---------------------------------------
    // system owner
    // ---------------------------------------
    function setMinLiquidityRatio(uint minLiquidityRatio) external override onlyOwner {
        PoolConfiguration.load().minLiquidityRatio = minLiquidityRatio;
    }

    function getMinLiquidityRatio() external view override returns (uint) {
        return PoolConfiguration.load().minLiquidityRatio;
    }

    modifier poolExists(uint128 poolId) {
        if (!Pool.load(poolId).exists() && poolId != 0) {
            revert PoolNotFound(poolId);
        }

        _;
    }
}
