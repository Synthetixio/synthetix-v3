// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@chainlink/contracts/src/v0.8/dev/functions/FunctionsClient.sol"; // Once published
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../../external/Functions.sol";
import "../../interfaces/ICrossChainPoolModule.sol";
import "../../interfaces/IPoolModule.sol";
import "../../storage/Config.sol";
import "../../storage/CrossChain.sol";
import "../../storage/Pool.sol";

contract CrossChainPoolModule is ICrossChainPoolModule {
    using Functions for Functions.Request;
    using CrossChain for CrossChain.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using Distribution for Distribution.Data;
    using Pool for Pool.Data;

    error PoolAlreadyExists(uint128, uint256);

    event OCRResponse(bytes32 indexed requestId, bytes result, bytes err);

    string internal constant _CONFIG_CHAINLINK_FUNCTIONS_ADDRESS = "chainlinkFunctionsAddr";

    string internal constant _REQUEST_TOTAL_DEBT_CODE = 
        "const maxFail = 1;"
        "const chainMapping = { '11155111': [`https://sepolia.infura.io/${secrets.INFURA_API_KEY}`], '80001': ['https://polygon-mumbai.infura.io/${secrets.INFURA_API_KEY}'] };"

        "let totalDebt = 0;"
        "for (let i = 0;i < args.length;i += 2) {"
        "    const chainId = Functions.decodeUint256(args[i]);"
        "    const poolIdHex = args[i + 1].slice(2);" // we don't really need to decode the pool id because its 
        "    const urls = chainMapping[chainId];"
        "    const params = { method: 'eth_call', params: [{ to: '0xffffffaeff0b96ea8e4f94b2253f31abdd875847', data: '0x47355c0f' + poolIdHex}] };"
        "    const results = await Promise.allSettled(urls.map(u => Functions.makeHttpRequest({ url, params })));"
        "    let sumAvg = 0;"
        "    for (const result of results) {"
        "        sumAvg += Functions.decodeInt256(res.data.result);"
        "    }"
        "    totalDebt += sumAvg / results.length;"
        "}"
        "return Functions.encodeInt256(totalDebt)";
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

        // TODO: use internal function
        //address(this).call(abi.encodeWithSelector(IPoolModule.setPoolConfiguration, poolId, newMarketConfigurations[0]));

        for (uint i = 1;i < pool.crossChain[0].pairedChains.length;i++) {
            uint64[] memory targetChainIds = new uint64[](1);
            targetChainIds[0] = pool.crossChain[0].pairedChains[i];
            CrossChain.load().broadcast(targetChainIds, abi.encodeWithSelector(IPoolModule.setPoolConfiguration.selector, poolId, newMarketConfigurations[i]), 100000);
        }
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
        Pool.Data storage pool = Pool.load(0);

        int256 totalDebt = abi.decode(response, (int256));

        int256 debtChange = totalDebt - pool.crossChain[0].latestDebtAmount;

        pool.vaultsDebtDistribution.distributeValue(debtChange);

        pool.crossChain[0].latestDebtAmount = totalDebt.to128();
        pool.crossChain[0].latestDataTimestamp = uint64(block.timestamp);
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

        upkeepNeeded = (block.timestamp - pool.crossChain[0].latestDataTimestamp) > pool.crossChain[0].chainlinkSubscriptionInterval;
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

        Pool.Data storage pool = Pool.loadExisting(abi.decode(data, (uint128)));

        // take this opporitunity to rebalance the markets in this pool
        // we do it here instaed of fulfill because there is no reason for this to fail if for some reason the function fails
        pool.recalculateAllCollaterals();
        pool.rebalanceMarketsInPool();

        string[] memory args = new string[](pool.crossChain[0].pairedChains.length);
        args[0] = string(abi.encode(block.chainid, pool.id));

        for (uint i = 1; i < args.length;i++) {
            uint64 chainId = pool.crossChain[0].pairedChains[i - 1];
            args[i] = string(abi.encode(
                chainId,
                pool.crossChain[0].pairedPoolIds[chainId]
            ));
        }

        Functions.Request memory req = Functions.Request({
            codeLocation: Functions.Location.Inline,
            secretsLocation: Functions.Location.Inline,
            language: Functions.CodeLanguage.JavaScript,
            source: _REQUEST_TOTAL_DEBT_CODE,
            secrets: _REQUEST_TOTAL_DEBT_SECRETS,
            args: args
        });
        bytes32 requestId = CrossChain.load().chainlinkFunctionsOracle.sendRequest(pool.crossChain[0].chainlinkSubscriptionId, abi.encode(req), 100000);
    }

    function getDONPublicKey() external view returns (bytes memory) {
        return "";
    }
}
