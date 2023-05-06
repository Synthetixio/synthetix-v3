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

    function createCrossChainPool(uint128 sourcePoolId, uint64 targetChainId) external override returns (uint256 gasTokenUsed) {
        Pool.Data storage pool = Pool.loadExisting(sourcePoolId);
        Pool.onlyPoolOwner(sourcePoolId, msg.sender);

        if (pool.crossChain[0].pairedPoolIds[targetChainId] != 0) {
            revert PoolAlreadyExists(targetChainId, pool.crossChain[0].pairedPoolIds[targetChainId]);
        }

        uint64[] memory targetChainIds = new uint64[](1);
        targetChainIds[0] = targetChainId;
        return CrossChain.load().broadcast(targetChainIds, abi.encodeWithSelector(this._recvCreateCrossChainPool.selector, block.chainid, sourcePoolId), 100000);
    }

    function _recvCreateCrossChainPool(uint64 srcChainId, uint64 srcPoolId) external override {
        CrossChain.onlyCrossChain();

        // create a pool with no owner. It can only be controlled by cross chain calls from its parent pool
        Pool.Data storage pool = Pool.create(type(uint128).max / 2 + SystemPoolConfiguration.load().lastPoolId++, address(0));

        uint64[] memory targetChainIds = new uint64[](1);
        targetChainIds[0] = srcChainId;
        //CrossChain.broadcast(targetChainIds, abi.encodeWithSelector(this._pairPool, srcPoolId, block.chainid, pool.id));
    }

    function setCrossChainPoolConfiguration(
        uint128 poolId, 
        MarketConfiguration.Data[][] memory newMarketConfigurations
    ) external override {
        Pool.Data storage pool = Pool.loadExisting(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        if (newMarketConfigurations.length != pool.crossChain[0].pairedChains.length + 1) {
            revert ParameterError.InvalidParameter("newMarketConfigurations", "must be same length as paired chains");
        }

        uint newTotalWeight;
        for (uint i = 0;i < newMarketConfigurations.length;i++) {
            for (uint j = 0;j < newMarketConfigurations[i].length;j++) {
                newTotalWeight += newMarketConfigurations[i][j].weightD18;
            }
        }

        // TODO: use internal function
        //address(this).call(abi.encodeWithSelector(IPoolModule.setPoolConfiguration, poolId, newMarketConfigurations[0]));

        for (uint i = 1;i < pool.crossChain[0].pairedChains.length;i++) {
            uint64[] memory targetChainIds = new uint64[](1);
            targetChainIds[0] = pool.crossChain[0].pairedChains[i];
            CrossChain.load().broadcast(targetChainIds, abi.encodeWithSelector(this._recvSetCrossChainPoolConfiguration.selector, poolId, newMarketConfigurations[i], newTotalWeight), 100000);
        }
    }

    function _recvSetCrossChainPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[] memory newMarketConfigurations,
        uint256 newTotalWeight
    ) external override {
        CrossChain.onlyCrossChain();

        Pool.Data storage pool = Pool.loadExisting(poolId);

        pool.crossChain[0].latestTotalWeights = newTotalWeight.to128();
        pool.setMarketConfiguration(newMarketConfigurations);
    }

    /**
    * @notice Callback that is invoked once the DON has resolved the request or hit an error
    *
    * @param requestId The request ID, returned by sendRequest()
    * @param response Aggregated response from the user code
    * @param err Aggregated error from the user code or from the execution pipeline
    * Either response or error parameter will be set, but never both
    */
    function handleOracleFulfillment(bytes32 requestId, bytes memory response, bytes memory err) external override {

        // TODO: check that chainlink functions oracle is the one sending this call

        if (err.length > 0) {
            return;
        }

        // TODO: be a real pool id
        Pool.Data storage pool = Pool.load(uint128(uint256(CrossChain.load().chainlinkFunctionsRequestInfo[requestId])));

        uint256 chainsCount = pool.crossChain[0].pairedChains.length;

        uint256[] memory liquidityAmounts = new uint256[](chainsCount);

        PoolCrossChainSync memory sync;

        sync.dataTimestamp = uint64(block.timestamp);

        for (uint i = 0; i < chainsCount;i++) {

            (
                uint256 chainLiquidity,
                int256 chainCumulativeMarketDebt,
                int256 chainTotalDebt,
                uint256 chainSyncTime
            ) = abi.decode(response, (uint256, int256, int256, uint256));

            liquidityAmounts[i] = chainLiquidity;
            sync.liquidity += chainLiquidity.to128();
            sync.cumulativeMarketDebt += chainCumulativeMarketDebt.to128();
            sync.totalDebt += chainTotalDebt.to128();

            sync.oldestDataTimestamp = sync.oldestDataTimestamp < chainSyncTime ? sync.oldestDataTimestamp : uint64(chainSyncTime);
        }

        int256 marketDebtChange = sync.cumulativeMarketDebt - pool.crossChain[0].latestSync.cumulativeMarketDebt;
        int256 remainingDebt = marketDebtChange;

        // send sync message
        for (uint i = 1;i < chainsCount;i++) {
            uint64[] memory targetChainIds = new uint64[](1);
            targetChainIds[0] = pool.crossChain[0].pairedChains[i];

            int256 chainAssignedDebt = marketDebtChange * liquidityAmounts[i].toInt() / sync.liquidity.toInt();
            remainingDebt -= chainAssignedDebt;

            // TODO: gas limit should be based on number of markets assigned to pool
            CrossChain.load().broadcast(targetChainIds, abi.encodeWithSelector(this.receivePoolHeartbeat.selector, pool.crossChain[0].pairedPoolIds[targetChainIds[0]], sync, chainAssignedDebt), 3000000);
        }

        _receivePoolHeartbeat(pool.id, sync, remainingDebt);
    }

    function receivePoolHeartbeat(uint128 poolId, PoolCrossChainSync memory syncData, int256 assignedDebt) external override {
        _receivePoolHeartbeat(poolId, syncData, assignedDebt);
    }

    function _receivePoolHeartbeat(uint128 poolId, PoolCrossChainSync memory syncData, int256 assignedDebt) internal {
        Pool.Data storage pool = Pool.loadExisting(poolId);
        
        // record sync data
        pool.crossChain[0].latestSync = syncData;

        // assign accumulated debt
        pool.distributeDebtToVaults(assignedDebt);
        
        // make sure the markets limits are set as expect
        pool.recalculateAllCollaterals();

        emit PoolHeartbeat(poolId, syncData);

    }

    function getPoolLastHeartbeat(uint128 poolId) external override returns (uint64) {
        return Pool.loadExisting(poolId).crossChain[0].latestSync.dataTimestamp;
    }

    function getThisChainPoolLiquidity(
        uint128 poolId
    ) external override returns (uint256 liquidityD18) {
        return Pool.loadExisting(poolId).vaultsDebtDistribution.totalSharesD18;
    }

    function getThisChainPoolCumulativeMarketDebt(
        uint128 poolId
    ) external override returns (int256 cumulativeDebtD18) {
        (cumulativeDebtD18, ) = Pool.loadExisting(poolId).rebalanceMarketsInPool();
    }

    function getThisChainPoolTotalDebt(
        uint128 poolId
    ) external view override returns (int256 totalDebtD18) {
        return Pool.loadExisting(poolId).totalVaultDebtsD18;
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
    function checkUpkeep(bytes memory data) public view override returns (bool upkeepNeeded, bytes memory) {
        uint poolId = abi.decode(data, (uint));
        Pool.Data storage pool = Pool.loadExisting(abi.decode(data, (uint128)));

        upkeepNeeded = (block.timestamp - pool.crossChain[0].latestSync.dataTimestamp) > pool.crossChain[0].chainlinkSubscriptionInterval;
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

        for (uint i = 2; i < args.length;i += 2) {
            uint64 chainId = pool.crossChain[0].pairedChains[i / 2];
            args[i] = string(abi.encode(
                chainId
            ));

            args[i + 1] = string(_encodeCrossChainPoolCall(pool.crossChain[0].pairedPoolIds[chainId]));
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
        calls[0] = abi.encodeWithSelector(this.getThisChainPoolLiquidity.selector, poolId);
        calls[1] = abi.encodeWithSelector(this.getThisChainPoolCumulativeMarketDebt.selector, poolId);
        calls[2] = abi.encodeWithSelector(this.getThisChainPoolTotalDebt.selector, poolId);
        calls[3] = abi.encodeWithSelector(this.getPoolLastHeartbeat.selector, poolId);

        return abi.encodeWithSelector(
            IMulticallModule.multicall.selector, 
            abi.encode(calls)
        );
    }

    function getDONPublicKey() external view returns (bytes memory) {
        return "";
    }
}
