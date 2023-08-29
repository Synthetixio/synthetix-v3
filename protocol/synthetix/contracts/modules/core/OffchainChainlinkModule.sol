//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../../interfaces/IOffchainChainlinkModule.sol";
import "../../interfaces/external/IAny2EVMMessageReceiver.sol";

import "../../storage/OracleManager.sol";
import "../../storage/Config.sol";
import "../../storage/CrossChainChainlink.sol";
import "../../storage/Pool.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract OffchainChainlinkModule is IAny2EVMMessageReceiver, IOffchainChainlinkModule {
		using Pool for Pool.Data;
		using CrossChainChainlink for CrossChainChainlink.Data;
		using SetUtil for SetUtil.UintSet;

		event NewSupportedCrossChainNetwork(uint64 chainId);

    /**
     * @inheritdoc IOffchainChainlinkModule
     */
    function configureChainlinkCrossChain(
        address ccipRouter,
        address ccipTokenPool,
        address chainlinkFunctions,
        uint64[] memory supportedNetworks,
        uint64[] memory ccipSelectors
    ) external override {
        OwnableStorage.onlyOwner();

        CrossChainChainlink.Data storage cc = CrossChainChainlink.load();

        cc.ccipRouter = ICcipRouterClient(ccipRouter);
        cc.chainlinkFunctionsOracle = FunctionsOracleInterface(chainlinkFunctions);

        uint64 myChainId = uint64(block.chainid);

        if (ccipSelectors.length != supportedNetworks.length) {
            revert ParameterError.InvalidParameter("ccipSelectors", "must match length");
        }

        for (uint i = 0; i < supportedNetworks.length; i++) {
            if (
                supportedNetworks[i] != myChainId &&
                !cc.supportedNetworks.contains(supportedNetworks[i])
            ) {
                cc.supportedNetworks.add(supportedNetworks[i]);
                emit NewSupportedCrossChainNetwork(supportedNetworks[i]);
            }

            cc.ccipChainIdToSelector[supportedNetworks[i]] = ccipSelectors[i];
            cc.ccipSelectorToChainId[ccipSelectors[i]] = supportedNetworks[i];
        }
    }

    function ccipReceive(CcipClient.Any2EVMMessage memory message) external {
        CrossChainChainlink.processCcipReceive(CrossChainChainlink.load(), message);
    }

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
				// TODO: uncomment when things are more clear
        /*CrossChainChainlink.Data storage crossChain = CrossChainChainlink.load();
        if (msg.sender != address(crossChain.chainlinkFunctionsOracle)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        if (err.length > 0) {
            return;
        }

        Pool.Data storage pool = Pool.loadExisting(
            uint128(uint256(crossChain.chainlinkFunctionsRequestInfo[requestId]))
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
            CrossChainChainlink.load().broadcast(
                targetChainIds,
                abi.encodeWithSelector(
                    this._recvPoolHeartbeat.selector,
                    pool.crossChain[0].pairedPoolIds[targetChainIds[0]],
                    sync,
                    chainAssignedDebt
                ),
                500000
            );
        }

        _receivePoolHeartbeat(pool.id, sync, remainingDebt);*/
    }

    function getDONPublicKey() external view override returns (bytes memory) {
        return CrossChainChainlink.load().chainlinkFunctionsOracle.getDONPublicKey();
    }
}
