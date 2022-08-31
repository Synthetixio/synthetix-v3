//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../../interfaces/IPoolModule.sol";
import "../../storage/PoolModuleStorage.sol";

import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/PoolMixin.sol";

contract PoolModule is IPoolModule, AccountRBACMixin, PoolMixin, OwnableMixin {
    error PoolAlreadyExists(uint poolId);
    error OnlyTokenProxyAllowed(address origin);
    error EmptyVault(uint poolId, address collateralType);
    error InvalidParameters(string incorrectParameter, string help);

    // ---------------------------------------
    // Minting
    // ---------------------------------------
    modifier onlyPoolOwner(uint poolId, address requestor) {
        if (_ownerOf(poolId) != requestor) {
            revert AccessError.Unauthorized(requestor);
        }

        _;
    }

    function createPool(uint requestedPoolId, address owner) external override {
        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (_exists(requestedPoolId)) {
            revert PoolAlreadyExists(requestedPoolId);
        }

        _poolModuleStore().pools[requestedPoolId].owner = owner;

        emit PoolCreated(owner, requestedPoolId);
    }

    // ---------------------------------------
    // Ownership
    // ---------------------------------------
    function nominateNewPoolOwner(address nominatedOwner, uint256 poolId)
        external
        override
        onlyPoolOwner(poolId, msg.sender)
    {
        _poolModuleStore().pools[poolId].nominatedOwner = nominatedOwner;

        emit NominatedNewOwner(nominatedOwner, poolId);
    }

    function acceptPoolOwnership(uint256 poolId) external override {
        if (_poolModuleStore().pools[poolId].nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _poolModuleStore().pools[poolId].owner = msg.sender;
        _poolModuleStore().pools[poolId].nominatedOwner = address(0);

        emit OwnershipAccepted(msg.sender, poolId);
    }

    function renouncePoolNomination(uint256 poolId) external override {
        if (_poolModuleStore().pools[poolId].nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _poolModuleStore().pools[poolId].nominatedOwner = address(0);

        emit OwnershipRenounced(msg.sender, poolId);
    }

    function ownerOf(uint256 poolId) external view override returns (address) {
        return _ownerOf(poolId);
    }

    function nominatedOwnerOf(uint256 poolId) external view override returns (address) {
        return _poolModuleStore().pools[poolId].nominatedOwner;
    }

    // ---------------------------------------
    // pool admin
    // ---------------------------------------
    function setPoolPosition(
        uint poolId,
        uint[] calldata markets,
        uint[] calldata weights,
        int[] calldata maxDebtShareValues
    ) external override poolExists(poolId) onlyPoolOwner(poolId, msg.sender) {
        if (markets.length != weights.length || markets.length != maxDebtShareValues.length) {
            revert InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match");
        }

        // TODO: this is not super efficient. we only call this to gather the debt accumulated from deployed pools
        // would be better if we could eliminate the call at the end somehow
        _rebalancePoolPositions(poolId);

        PoolData storage poolData = _poolModuleStore().pools[poolId];

        uint totalWeight = 0;
        uint i = 0;

        {
            uint lastMarketId = 0;

            for (
                ;
                i < (markets.length < poolData.poolDistribution.length ? markets.length : poolData.poolDistribution.length);
                i++
            ) {
                if (markets[i] <= lastMarketId) {
                    revert InvalidParameters("markets", "must be supplied in strictly ascending order");
                }
                lastMarketId = markets[i];

                MarketDistribution storage distribution = poolData.poolDistribution[i];
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

                MarketDistribution memory distribution;
                distribution.market = markets[i];
                distribution.weight = uint128(weights[i]);
                distribution.maxDebtShareValue = int128(maxDebtShareValues[i]);

                poolData.poolDistribution.push(distribution);

                totalWeight += weights[i];
            }
        }

        uint popped = poolData.poolDistribution.length - i;
        for (i = 0; i < popped; i++) {
            _rebalanceMarket(poolData.poolDistribution[poolData.poolDistribution.length - 1].market, poolId, 0, 0);
            poolData.poolDistribution.pop();
        }

        poolData.totalWeights = totalWeight;

        _rebalancePoolPositions(poolId);

        emit PoolPositionSet(poolId, markets, weights, msg.sender);
    }

    function getPoolPosition(uint poolId)
        external
        view
        override
        returns (
            uint[] memory,
            uint[] memory,
            int[] memory
        )
    {
        PoolData storage pool = _poolModuleStore().pools[poolId];

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

    function setPoolName(uint poolId, string memory name)
        external
        override
        poolExists(poolId)
        onlyPoolOwner(poolId, msg.sender)
    {
        _poolModuleStore().pools[poolId].name = name;
    }

    function getPoolName(uint poolId) external view override returns (string memory poolName) {
        return _poolModuleStore().pools[poolId].name;
    }

    // ---------------------------------------
    // system owner
    // ---------------------------------------
    function setMinLiquidityRatio(uint minLiquidityRatio) external override onlyOwner {
        _poolModuleStore().minLiquidityRatio = minLiquidityRatio;
    }

    function getMinLiquidityRatio() external view override returns (uint) {
        return _poolModuleStore().minLiquidityRatio;
    }
}
