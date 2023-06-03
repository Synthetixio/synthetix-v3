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
import "../../storage/CrossChain.sol";
import "../../storage/Pool.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

contract CrossChainUpkeepModule is ICrossChainUpkeepModule {
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

    string internal constant _REQUEST_TOTAL_DEBT_CODE =
        "const maxFail = 1;"
        "const chainMapping = { '11155111': [`https://sepolia.infura.io/${secrets.INFURA_API_KEY}`], '80001': ['https://polygon-mumbai.infura.io/${secrets.INFURA_API_KEY}'] };"
        "let responses = [];"
        "for (let i = 0;i < args.length;i += 2) {"
        "    const chainId = Functions.decodeUint256(args[i]);"
        "    const callHex = args[i + 1];"
        "    const urls = chainMapping[chainId];"
        "    const params = { method: 'eth_call', params: [{ to: '0xffffffaeff0b96ea8e4f94b2253f31abdd875847', data: callHex }] };"
        "    const results = await Promise.allSettled(urls.map(u => Functions.makeHttpRequest({ url, params })));"
        "    let ress = 0;"
        "    for (const result of results) {"
        "        ress.push(Functions.decodeInt256(res.data.result));"
        "    }"
        "    ress.sort();"
        "    responses.push(ress[ress.length / 2].slice(2));"
        "}"
        "return Buffer.from(responses.join(''));";
    bytes internal constant _REQUEST_TOTAL_DEBT_SECRETS = "0xwhatever";

    /**
     * @notice Callback that is invoked once the DON has resolved the request or hit an error
     *
     * @param requestId The request ID, returned by sendRequest()
     * @param response Aggregated response from the user code
     * @param err Aggregated error from the user code or from the execution pipeline
     * Either response or error parameter will be set, but never both
     */
    function handleOracleFulfillment(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external override {
        // TODO: check that chainlink functions oracle is the one sending this call

        if (err.length > 0) {
            return;
        }

        // TODO: be a real pool id
        Pool.Data storage pool = Pool.load(
            uint128(uint256(CrossChain.load().chainlinkFunctionsRequestInfo[requestId]))
        );

        uint256 chainsCount = pool.crossChain[0].pairedChains.length;

        uint256[] memory liquidityAmounts = new uint256[](chainsCount);

        PoolCrossChainSync.Data memory sync;

        sync.dataTimestamp = uint64(block.timestamp);

        for (uint i = 0; i < chainsCount; i++) {
            (
                uint256 chainLiquidity,
                int256 chainCumulativeMarketDebt,
                int256 chainTotalDebt,
                uint256 chainSyncTime,
                uint256 chainLastPoolConfigTime
            ) = abi.decode(response, (uint256, int256, int256, uint256, uint256));

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
            CrossChain.load().broadcast(
                targetChainIds,
                abi.encodeWithSelector(
                    this._recvPoolHeartbeat.selector,
                    pool.crossChain[0].pairedPoolIds[targetChainIds[0]],
                    sync,
                    chainAssignedDebt
                ),
                3000000
            );
        }

        _receivePoolHeartbeat(pool.id, sync, remainingDebt);
    }

    function _recvPoolHeartbeat(
        uint128 poolId,
        PoolCrossChainSync.Data memory syncData,
        int256 assignedDebt
    ) external override {
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
        pool.distributeDebtToVaults(assignedDebt);

        // make sure the markets limits are set as expect
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
    ) public view override returns (bool upkeepNeeded, bytes memory) {
        uint poolId = abi.decode(data, (uint));
        Pool.Data storage pool = Pool.loadExisting(abi.decode(data, (uint128)));

        upkeepNeeded =
            (block.timestamp - pool.crossChain[0].latestSync.dataTimestamp) >
            pool.crossChain[0].chainlinkSubscriptionInterval;
    }

    /**
     * @notice Called by Automation to trigger a Functions request
     *
     * The function's argument is unused in this example, but there is an option to have Automation pass custom data
     * returned by checkUpkeep (See Chainlink Automation documentation)
     */
    function performUpkeep(bytes calldata data) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        require(upkeepNeeded, "Time interval not met");

        uint128 poolId = abi.decode(data, (uint128));
        Pool.Data storage pool = Pool.loadExisting(poolId);

        // take this opporitunity to rebalance the markets in this pool
        // we do it here instaed of fulfill because there is no reason for this to fail if for some reason the function fails

        string[] memory args = new string[](pool.crossChain[0].pairedChains.length * 2);
        args[0] = string(abi.encode(block.chainid));
        args[1] = string(_encodeCrossChainPoolCall(poolId));

        for (uint i = 0; i < args.length; i += 2) {
            uint64 chainId = pool.crossChain[0].pairedChains[i / 2];
            args[i] = string(abi.encode(chainId));

            args[i + 1] = string(
                _encodeCrossChainPoolCall(pool.crossChain[0].pairedPoolIds[chainId])
            );
        }

        Functions.Request memory req = Functions.Request({
            codeLocation: Functions.Location.Inline,
            secretsLocation: Functions.Location.Inline,
            language: Functions.CodeLanguage.JavaScript,
            source: _REQUEST_TOTAL_DEBT_CODE,
            secrets: _REQUEST_TOTAL_DEBT_SECRETS,
            args: args
        });
        bytes32 requestId = CrossChain.load().chainlinkFunctionsOracle.sendRequest(
            pool.crossChain[0].chainlinkSubscriptionId,
            abi.encode(req),
            100000
        );

        CrossChain.load().chainlinkFunctionsRequestInfo[requestId] = bytes32(uint256(pool.id));
    }

    function _encodeCrossChainPoolCall(uint128 poolId) internal pure returns (bytes memory) {
        bytes[] memory calls = new bytes[](4);
        calls[0] = abi.encodeWithSelector(ICrossChainPoolModule.getThisChainPoolLiquidity.selector, poolId);
        calls[1] = abi.encodeWithSelector(
            ICrossChainPoolModule.getThisChainPoolCumulativeMarketDebt.selector,
            poolId
        );
        calls[2] = abi.encodeWithSelector(ICrossChainPoolModule.getThisChainPoolTotalDebt.selector, poolId);
        calls[3] = abi.encodeWithSelector(ICrossChainPoolModule.getPoolLastHeartbeat.selector, poolId);
        calls[4] = abi.encodeWithSelector(
            IPoolModule.getPoolLastConfigurationTime.selector,
            poolId
        );

        return abi.encodeWithSelector(IMulticallModule.multicall.selector, abi.encode(calls));
    }

    function getDONPublicKey() external view returns (bytes memory) {
        return "";
    }
}
