// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@chainlink/contracts/src/v0.8/dev/functions/FunctionsClient.sol"; // Once published
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../../external/Functions.sol";
import "../../interfaces/ICrossChainPoolModule.sol";
import "../../interfaces/IPoolModule.sol";
import "../../interfaces/IMulticallModule.sol";
import "../../storage/Config.sol";
import "../../storage/CrossChain.sol";
import "../../storage/Pool.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

contract CrossChainPoolModule is ICrossChainPoolModule {
    using Functions for Functions.Request;
    using CrossChain for CrossChain.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using SafeCastU128 for uint128;
    using Distribution for Distribution.Data;
    using Pool for Pool.Data;

    error PoolAlreadyExists(uint128, uint256);

    event OCRResponse(bytes32 indexed requestId, bytes result, bytes err);

    bytes32 internal constant _CREATE_CROSS_CHAIN_POOL_FEATURE_FLAG = "createCrossChainPool";
    bytes32 internal constant _SET_CROSS_CHAIN_POOL_CONFIGURATION_FEATURE_FLAG =
        "setCrossChainPoolConfiguration";

    string internal constant _CONFIG_CHAINLINK_FUNCTIONS_ADDRESS = "chainlinkFunctionsAddr";

    function createCrossChainPool(
        uint128 sourcePoolId,
        uint64 targetChainId
    ) external payable override returns (uint128 crossChainPoolId, uint256 gasTokenUsed) {
        FeatureFlag.ensureAccessToFeature(_CREATE_CROSS_CHAIN_POOL_FEATURE_FLAG);

        Pool.Data storage pool = Pool.loadExisting(sourcePoolId);
        Pool.onlyPoolOwner(sourcePoolId, msg.sender);

        if (pool.crossChain[0].pairedPoolIds[targetChainId] != 0) {
            revert PoolAlreadyExists(
                targetChainId,
                pool.crossChain[0].pairedPoolIds[targetChainId]
            );
        }

        crossChainPoolId = pool.addCrossChain(targetChainId);

        uint64[] memory targetChainIds = new uint64[](1);
        targetChainIds[0] = targetChainId;
        gasTokenUsed = CrossChain.load().broadcast(
            targetChainIds,
            abi.encodeWithSelector(
                this._recvCreateCrossChainPool.selector,
                block.chainid,
                sourcePoolId
            ),
            200000
        );

        CrossChain.refundLeftoverGas(gasTokenUsed);
    }

    function _recvCreateCrossChainPool(uint64 srcChainId, uint128 srcPoolId) external override {
        CrossChain.onlyCrossChain();

        // create a pool with no owner. It can only be controlled by cross chain calls from its parent pool
        uint128 newPoolId = Pool.getCrossChainPoolId(srcChainId, srcPoolId);
        Pool.Data storage pool = Pool.create(newPoolId, address(0));

        pool.crossChain[0].pairedChains.push(srcChainId);
        pool.crossChain[0].pairedChains.push(uint64(block.chainid));

        pool.crossChain[0].pairedPoolIds[srcChainId] = srcPoolId;

        emit CrossChainSecondaryPoolCreated(srcChainId, srcPoolId, newPoolId);
    }

    function setCrossChainPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[][] memory newMarketConfigurations
    ) external payable override returns (uint256 gasTokenUsed) {
        FeatureFlag.ensureAccessToFeature(_SET_CROSS_CHAIN_POOL_CONFIGURATION_FEATURE_FLAG);

        Pool.Data storage pool = Pool.loadExisting(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        if (newMarketConfigurations.length != pool.crossChain[0].pairedChains.length + 1) {
            revert ParameterError.InvalidParameter(
                "newMarketConfigurations",
                "must be same length as paired chains"
            );
        }

        uint newTotalWeight;
        for (uint i = 0; i < newMarketConfigurations.length; i++) {
            for (uint j = 0; j < newMarketConfigurations[i].length; j++) {
                newTotalWeight += newMarketConfigurations[i][j].weightD18;
            }
        }

        // TODO: use internal function
        //address(this).call(abi.encodeWithSelector(IPoolModule.setPoolConfiguration, poolId, newMarketConfigurations[0]));

        CrossChain.Data storage crossChain = CrossChain.load();
        for (uint i = 1; i < pool.crossChain[0].pairedChains.length; i++) {
            uint64[] memory targetChainIds = new uint64[](1);
            targetChainIds[0] = pool.crossChain[0].pairedChains[i];
            gasTokenUsed += crossChain.broadcast(
                targetChainIds,
                abi.encodeWithSelector(
                    this._recvSetCrossChainPoolConfiguration.selector,
                    poolId,
                    newMarketConfigurations[i],
                    newTotalWeight,
                    uint64(block.timestamp)
                ),
                100000
            );
        }

        CrossChain.refundLeftoverGas(gasTokenUsed);
    }

    function _recvSetCrossChainPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[] memory newMarketConfigurations,
        uint256 newTotalWeight,
        uint64 configTimestamp
    ) external override {
        CrossChain.onlyCrossChain();

        Pool.Data storage pool = Pool.loadExisting(poolId);

        pool.setMarketConfiguration(newMarketConfigurations);
        pool.crossChain[0].latestTotalWeights = newTotalWeight.to128();
        pool.lastConfigurationTime = configTimestamp;
    }

    function getPoolCrossChainInfo(
        uint128 poolId
    )
        external
        view
        override
        returns (uint64[] memory pairedChainIds, uint128 primaryPoolId, uint128 secondaryPoolId)
    {
        Pool.Data storage pool = Pool.loadExisting(poolId);

        if (pool.isCrossChainEnabled()) {
            pairedChainIds = new uint64[](pool.crossChain[0].pairedChains.length);
            for (uint256 i = 0; i < pool.crossChain[0].pairedChains.length; i++) {
                pairedChainIds[i] = pool.crossChain[0].pairedChains[i];
            }

            primaryPoolId = pool.crossChain[0].pairedPoolIds[0];
            secondaryPoolId = pool.crossChain[0].pairedPoolIds[1];
        }
    }

    function getPoolLastHeartbeat(uint128 poolId) external view override returns (uint64) {
        return Pool.loadExisting(poolId).crossChain[0].latestSync.dataTimestamp;
    }

    function getThisChainPoolLiquidity(
        uint128 poolId
    ) external view override returns (uint256 liquidityD18) {
        return Pool.loadExisting(poolId).totalCapacityD18;
    }

    function getThisChainPoolCumulativeMarketDebt(
        uint128 poolId
    ) external override returns (int256 cumulativeDebtD18) {
        (, cumulativeDebtD18) = Pool.loadExisting(poolId).distributeDebtToVaults(address(0));
    }

    function getThisChainPoolTotalDebt(
        uint128 poolId
    ) external view override returns (int256 totalDebtD18) {
        return Pool.loadExisting(poolId).totalVaultDebtsD18;
    }
}
