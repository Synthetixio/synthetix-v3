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

contract CrossChainUpkeepModule is ICrossChainUpkeepModule {
    using Functions for Functions.Request;
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

    bytes32 internal constant _CONFIG_SYNC_POOL_CODE_ADDRESS = "performUpkeep_syncPool";
    bytes32 internal constant _CONFIG_SYNC_POOL_SECRETS_ADDRESS = "performUpkeep_syncPoolSecrets";

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
        pool.assignDebt(assignedDebt);

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
				for (uint i = 0;i < calls.length;i++) {
						calls[i] = _encodeCrossChainPoolCall(pool.crossChain[0].pairedPoolIds[pool.crossChain[0].pairedChains[i]]);
				}

        address(this).call(abi.encodeWithSelector(
						pool.crossChain[0].offchainReadSelector,
            pool.crossChain[0].subscriptionId,
						pool.crossChain[0].pairedChains,
						calls,
            300000
        ));
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

    /**
     * loads the bytes deployed to the specified address
     * used to get the inline execution code for chainlink
     */
    function _codeAt(address _addr) public view returns (bytes memory o_code) {
        assembly {
            // retrieve the size of the code, this needs assembly
            let size := extcodesize(_addr)
            // allocate output byte array - this could also be done without assembly
            // by using o_code = new bytes(size)
            o_code := mload(0x40)
            // new "memory end" including padding
            mstore(0x40, add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            // store length in memory
            mstore(o_code, size)
            // actually retrieve the code, this needs assembly
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
        }
    }

    /**
     * This is basically required to send binary data to chainlink functions
     */
    function _bytesToHexString(bytes memory buffer) public pure returns (string memory) {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer.length * 2);

        bytes memory _base = "0123456789abcdef";

        for (uint256 i = 0; i < buffer.length; i++) {
            converted[i * 2] = _base[uint8(buffer[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer[i]) % _base.length];
        }

        return string(abi.encodePacked("0x", converted));
    }
}
