// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@chainlink/contracts/src/v0.8/dev/functions/FunctionsClient.sol"; // Once published
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../../external/Functions.sol";
import "../../interfaces/ICrossChainPoolModule.sol";
import "../../interfaces/ICrossChainUpkeepModule.sol";
import "../../interfaces/IPoolModule.sol";
import "../../interfaces/IMulticallModule.sol";
import "../../storage/Config.sol";
import "../../utils/CrossChain.sol";
import "../../storage/Pool.sol";

import "hardhat/console.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import "@synthetixio/core-contracts/contracts/utils/CallUtil.sol";

contract CrossChainUpkeepModule is ICrossChainUpkeepModule {
    using Functions for Functions.Request;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using SafeCastU128 for uint128;
    using Distribution for Distribution.Data;
    using Pool for Pool.Data;
    using CallUtil for address;

    error PoolAlreadyExists(uint128, uint256);

    event OCRResponse(bytes32 indexed requestId, bytes result, bytes err);

    bytes32 internal constant _CREATE_CROSS_CHAIN_POOL_FEATURE_FLAG = "createCrossChainPool";
    bytes32 internal constant _SET_CROSS_CHAIN_POOL_CONFIGURATION_FEATURE_FLAG =
        "setCrossChainPoolConfiguration";

    bytes32 internal constant _CONFIG_SYNC_POOL_CODE_ADDRESS = "performUpkeep_syncPool";
    bytes32 internal constant _CONFIG_SYNC_POOL_SECRETS_ADDRESS = "performUpkeep_syncPoolSecrets";

    function _recvPoolHeartbeat(
        uint128 poolId,
        PoolCrossChainSync.Data memory syncData,
        int256 assignedDebt
    ) external override {
        CrossChain.onlyCrossChain();
        _receivePoolHeartbeat(poolId, syncData, assignedDebt);
    }

    function _receivePoolHeartbeat(
        uint128 poolId,
        PoolCrossChainSync.Data memory syncData,
        int256 assignedDebt
    ) internal {
        Pool.Data storage pool = Pool.loadExisting(poolId);

        // record sync data
        pool.setCrossChainSyncData(syncData);

        // assign accumulated debt
        console.log("assign debt");
        pool.assignDebt(assignedDebt);

        // make sure the markets limits are set as expect
        console.log("recalculate all collaterals");
        pool.recalculateAllCollaterals();

        emit PoolHeartbeat(poolId, syncData);
    }

    /**
     * @notice Used by Automation to check if performUpkeep should be called.
     *
     * The function's argument is unused in this example, but there is an option to have Automation pass custom data
     * that can be used by the checkUpkeep function.
     *
     * Returns a tuple where the first element is a boolean which determines if upkeep is needed and the
     * second element contains custom bytes data which is passed to performUpkeep when it is called by Automation.
     */
    function checkUpkeep(
        bytes memory data
    ) public view override returns (bool upkeepNeeded, bytes memory performData) {
        uint128 poolId = abi.decode(data, (uint128));
        Pool.Data storage pool = Pool.loadExisting(poolId);

        upkeepNeeded =
            (block.timestamp - pool.crossChain[0].latestSync.dataTimestamp) >
            pool.crossChain[0].subscriptionInterval;

        performData = data;
    }

    /**
     * @notice Called by Automation to trigger a Functions request
     *
     * The function's argument is unused in this example, but there is an option to have Automation pass custom data
     * returned by checkUpkeep (See Chainlink Automation documentation)
     */
    function performUpkeep(bytes calldata data) external override {
        (bool upkeepNeeded, ) = checkUpkeep(data);
        require(upkeepNeeded, "Time interval not met");

        uint128 poolId = abi.decode(data, (uint128));
        Pool.Data storage pool = Pool.loadExisting(poolId);

        // take this opporitunity to rebalance the markets in this pool
        // we do it here instead of fulfill because there is no reason for this to fail if for some reason the function fails

        bytes[] memory calls = new bytes[](pool.crossChain[0].pairedChains.length);
        for (uint i = 0; i < calls.length; i++) {
            calls[i] = _encodeCrossChainPoolCall(
                pool.crossChain[0].pairedPoolIds[pool.crossChain[0].pairedChains[i]]
            );
        }

        bytes[] memory responses = abi.decode(
            address(this).tryCall(
                abi.encodeWithSelector(
                    pool.crossChain[0].offchainReadSelector,
                    pool.crossChain[0].subscriptionId,
                    pool.crossChain[0].pairedChains,
                    calls,
                    300000
                )
            ),
            (bytes[])
        );

        // now that we have cross chain data, lets parse the result
        uint256 chainsCount = pool.crossChain[0].pairedChains.length;

        uint256[] memory liquidityAmounts = new uint256[](chainsCount);

        PoolCrossChainSync.Data memory sync;

        sync.dataTimestamp = uint64(block.timestamp);

        for (uint i = 0; i < chainsCount; i++) {
            bytes[] memory chainResponses = abi.decode(responses[i], (bytes[]));

            uint256 chainLiquidity = abi.decode(chainResponses[0], (uint256));
            int256 chainCumulativeMarketDebt = abi.decode(chainResponses[1], (int256));
            int256 chainTotalDebt = abi.decode(chainResponses[2], (int256));
            uint256 chainSyncTime = abi.decode(chainResponses[3], (uint256));
            uint256 chainLastPoolConfigTime = abi.decode(chainResponses[4], (uint256));

            liquidityAmounts[i] = chainLiquidity;
            sync.liquidity += chainLiquidity.to128();
            sync.cumulativeMarketDebt += chainCumulativeMarketDebt.to128();
            sync.totalDebt += chainTotalDebt.to128();

            sync.oldestDataTimestamp = sync.oldestDataTimestamp < chainSyncTime
                ? sync.oldestDataTimestamp
                : uint64(chainSyncTime);
            sync.oldestPoolConfigTimestamp = sync.oldestPoolConfigTimestamp <
                chainLastPoolConfigTime
                ? sync.oldestPoolConfigTimestamp
                : uint64(chainLastPoolConfigTime);
        }

        int256 marketDebtChange = sync.cumulativeMarketDebt -
            pool.crossChain[0].latestSync.cumulativeMarketDebt;
        int256 remainingDebt = marketDebtChange;

        // send sync message
        for (uint i = 1; i < chainsCount; i++) {
            uint64[] memory targetChainIds = new uint64[](1);
            targetChainIds[0] = pool.crossChain[0].pairedChains[i];

            int256 chainAssignedDebt = (marketDebtChange * liquidityAmounts[i].toInt()) /
                sync.liquidity.toInt();
            remainingDebt -= chainAssignedDebt;

            // TODO: gas limit should be based on number of markets assigned to pool
            // TODO: broadcast will be paid in LINK
            address(this).tryCall(
                abi.encodeWithSelector(
                    pool.crossChain[0].broadcastSelector,
                    pool.crossChain[0].pairedChains,
                    abi.encodeWithSelector(
                        this._recvPoolHeartbeat.selector,
                        pool.crossChain[0].pairedPoolIds[targetChainIds[0]],
                        sync,
                        chainAssignedDebt
                    ),
                    500000
                )
            );
        }

        _receivePoolHeartbeat(pool.id, sync, remainingDebt);
    }

    function _encodeCrossChainPoolCall(uint128 poolId) internal pure returns (bytes memory) {
        bytes[] memory calls = new bytes[](5);
        calls[0] = abi.encodeWithSelector(
            ICrossChainPoolModule.getThisChainPoolLiquidity.selector,
            poolId
        );
        calls[1] = abi.encodeWithSelector(
            ICrossChainPoolModule.getThisChainPoolCumulativeMarketDebt.selector,
            poolId
        );
        calls[2] = abi.encodeWithSelector(
            ICrossChainPoolModule.getThisChainPoolTotalDebt.selector,
            poolId
        );
        calls[3] = abi.encodeWithSelector(
            ICrossChainPoolModule.getPoolLastHeartbeat.selector,
            poolId
        );
        calls[4] = abi.encodeWithSelector(
            IPoolModule.getPoolLastConfigurationTime.selector,
            poolId
        );

        return abi.encodeWithSelector(IMulticallModule.multicall.selector, abi.encode(calls));
    }
}
