// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {Functions, FunctionsClient} from "../../chainlink/functions/FunctionsClient.sol";
// import "@chainlink/contracts/src/v0.8/dev/functions/FunctionsClient.sol"; // Once published
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../../interfaces/ICrossChainPoolModule.sol";
import "../../storage/Config.sol";
import "../../storage/Pool.sol";

contract FunctionsConsumer is ICrossChainPoolModule, FunctionsClient, AutomationCompatibleInterface {
    using Functions for Functions.Request;

    event OCRResponse(bytes32 indexed requestId, bytes result, bytes err);

    string internal constant _CONFIG_CHAINLINK_FUNCTIONS_ADDRESS = "chainlinkFunctionsAddr";

    string internal constant _REQUEST_TOTAL_DEBT_CODE = 
        "const maxFail = 1;"
        "const chainMapping = { '11155111': [`https://sepolia.infura.io/${secrets.INFURA_API_KEY}`], '80001': ['https://polygon-mumbai.infura.io/${secrets.INFURA_API_KEY}'] };"

        "let totalDebt = 0;"
        "for (let i = 1;i < args.length;i += 2) {"
        "    const chainId = Functions.decodeUint256(args[i]);"
        "    const poolIdHex = args[i + 1].slice(2);" // we don't really need to decode the pool id because its 
        "    const urls = chainMapping[chainId];"
        "    for (const url of urls) {"
        "        const params = { method: 'eth_call', params: [{ to: '0xffffffaeff0b96ea8e4f94b2253f31abdd875847', data: '0x47355c0f' + poolIdHex] };"
        "        const res = await Functions.makeHttpRequest({ url, params });"
        "    }"
        "    totalDebt += Functions.decodeInt256(res.data.result);"
        "}"
        "return Functions.encodeInt256(totalDebt)";
    string internal constant _REQUEST_TOTAL_DEBT_SECRETS = "0xwhatever";

    /**
    * @notice Executes once when a contract is created to initialize state variables
    */
    // https://github.com/protofire/solhint/issues/242
    // solhint-disable-next-line no-empty-blocks
    constructor() FunctionsClient(address(0)) {}

    /**
    * @notice Send a simple request
    *
    * @param source JavaScript source code
    * @param secrets Encrypted secrets payload
    * @param args List of arguments accessible from within the source code
    * @param subscriptionId Funtions billing subscription ID
    * @param gasLimit Maximum amount of gas used to call the client contract's `handleOracleFulfillment` function
    * @return Functions request ID
    */
    function executeRequest(
        string calldata source,
        bytes calldata secrets,
        string[] calldata args,
        uint64 subscriptionId,
        uint32 gasLimit
    ) public returns (bytes32) {
        Functions.Request memory req;
        req.initializeRequest(Functions.Location.Inline, Functions.CodeLanguage.JavaScript, source);
        if (secrets.length > 0) {
            req.addRemoteSecrets(secrets);
        }
        if (args.length > 0) req.addArgs(args);

        bytes32 assignedReqID = sendRequest(req, subscriptionId, gasLimit);
        latestRequestId = assignedReqID;
        return assignedReqID;
    }

    /**
    * @notice Callback that is invoked once the DON has resolved the request or hit an error
    *
    * @param requestId The request ID, returned by sendRequest()
    * @param response Aggregated response from the user code
    * @param err Aggregated error from the user code or from the execution pipeline
    * Either response or error parameter will be set, but never both
    */
    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        if (err != "") {
            return;
        }

        Pool.Data storage pool = Pool.load(poolId);

        uint256 totalDebt = abi.decode(response, (uint256));

        int256 debtChange = totalDebt.toInt() - pool.crossChain[0].latestDebtAmount;

        pool.vaultsDebtDistribution.distributeValue(debtChange);

        pool.crossChain[0].latestDebtAmount = totalDebt;
        pool.crossChain[0].latestDebtTimestamp = uint64(block.timestamp);
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
        Pool.Data storage pool = Pool.loadExisting(poolId);

        upkeepNeeded = (block.timestamp - pool.crossChain[0].latestDebtTimestamp) > pool.crossChain[0].chainlinkSubscriptionInterval;
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
        lastUpkeepTimeStamp = block.timestamp;
        upkeepCounter = upkeepCounter + 1;

        // take this opporitunity to rebalance the markets in this pool
        // we do it here instaed of fulfill because there is no reason for this to fail if for some reason the function fails
        pool.rebalanceMarketsInPool();

        setOracle(Config.readAddress(_CONFIG_CHAINLINK_FUNCTIONS_ADDRESS));

        Pool.Data pool = Pool.load(poolId);

        string[] memory args = new string[](pool.crossChain[0].pairedChains.length + 1);
        args[0] = abi.encode(block.chainId, poolId);

        for (uint i = 1; i < args.length;i++) {
            uint32 chainId = pool.crossChain[0].pairedChains[i - 1];
            args[i] = abi.encode(
                chainId,
                pool.crossChain[0].pairedPoolIds[chainId]
            );
        }

        Functions.Request memory req = Functions.Request({
            codeLocation: Location.Inline,
            secretsLocation: Location.Inline,
            language: Language.JavaScript,
            source: _REQUEST_TOTAL_DEBT_CODE,
            secrets: _REQUEST_TOTAL_DEBT_SECRETS,
            args: args
        });
        bytes32 requestId = sendRequest(subscriptionId, req, fulfillGasLimit);

        /*s_pendingRequests[requestId] = s_oracle.getRegistry();
        emit RequestSent(requestId);
        latestRequestId = requestId;*/
    }
}
