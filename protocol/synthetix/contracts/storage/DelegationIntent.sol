//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Config.sol";
import "./Pool.sol";

import "../interfaces/IVaultModule.sol";

/**
 * @title Represents a delegation (or undelegation) intent.
 */
library DelegationIntent {
    using Pool for Pool.Data;

    bytes32 private constant _ATOMIC_VALUE_LATEST_ID = "delegateIntent_idAsNonce";

    /**
     * Intent Lifecycle:
     *
     *          |<---- Delay ---->|<-- Processing Window -->|
     * Time ----|-----------------|-------------------------|---->
     *          ^                 ^                         ^
     *          |                 |                         |
     *  declarationTime    processingStartTime    processingEndTime
     *
     * Key:
     * - declarationTime: Timestamp at which the intent is declared.
     * - processingStartTime: Timestamp from which the intent can start being processed.
     * - processingEndTime: Timestamp after which the intent cannot be processed.
     *
     * The intent can be processed only between processingStartTime and processingEndTime.
     */
    struct Data {
        /**
         * @notice The ID of the account that has an outstanding intent to delegate a new amount of collateral to
         */
        uint128 accountId;
        /**
         * @notice The ID of the pool for which the account has an outstanding intent to delegate a new amount of collateral to
         */
        uint128 poolId;
        /**
         * @notice The address of the collateral type that the account has an outstanding intent to delegate a new amount of
         */
        address collateralType;
        /**
         * @notice The delta amount of collateral that the account has an
         * outstanding intent to delegate/undelegate to the pool,
         * denominated with 18 decimals of precision
         */
        int256 deltaCollateralAmountD18;
        /**
         * @notice The intended amount of leverage associated with the new
         * amount of collateral that the account has an outstanding intent
         * to delegate to the pool
         * @dev The system currently only supports 1x leverage
         */
        uint256 leverage;
        /**
         * @notice The timestamp at which the intent was declared
         */
        uint32 declarationTime;
        /**
         * @notice Id of the epoch where this intent was created. Used to validate if the epoch is still valid
         */
        uint128 epochId;
    }

    /**
     * @dev Returns the delegation intent stored at the specified nonce id.
     */
    function load(uint256 id) internal pure returns (Data storage delegationIntent) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.DelegationIntent", id));
        assembly {
            delegationIntent.slot := s
        }
    }

    /**
     * @dev Returns the delegation intent stored at the specified nonce id. Checks if it's valid
     */
    function loadValid(uint256 id) internal view returns (Data storage delegationIntent) {
        delegationIntent = load(id);

        // Notice, using declarationTime as a proxy for existence to reduce the struct by one slot removing the id
        if (delegationIntent.declarationTime == 0) {
            revert IVaultModule.DelegationIntentNotExists();
        }
    }

    function latestId() internal view returns (uint256) {
        return Config.readUint(_ATOMIC_VALUE_LATEST_ID, 0);
    }

    function nextId() internal returns (uint256 id) {
        id = Config.readUint(_ATOMIC_VALUE_LATEST_ID, 0) + 1;
        Config.put(_ATOMIC_VALUE_LATEST_ID, bytes32(id));
    }

    function processingStartTime(Data storage self) internal view returns (uint32) {
        (uint32 _processingStartTime, ) = getProcessingWindow(self);
        return _processingStartTime;
    }

    function processingEndTime(Data storage self) internal view returns (uint32) {
        (, uint32 _processingEndTime) = getProcessingWindow(self);
        return _processingEndTime;
    }

    // function checkIsExecutable(Data storage self) internal view {
    //     (uint32 _processingStartTime, uint32 _processingEndTime) = getProcessingWindow(self);

    //     if (block.timestamp < _processingStartTime)
    //         revert IVaultModule.DelegationIntentNotReady(
    //             self.declarationTime,
    //             _processingStartTime
    //         );
    //     if (block.timestamp >= _processingEndTime)
    //         revert IVaultModule.DelegationIntentExpired(self.declarationTime, _processingEndTime);
    // }

    function isExecutable(Data storage self, uint128 currentEpochId) internal view returns (bool) {
        (uint32 _processingStartTime, uint32 _processingEndTime) = getProcessingWindow(self);

        return
            currentEpochId == self.epochId &&
            block.timestamp >= _processingStartTime &&
            block.timestamp < _processingEndTime;
    }

    function intentExpired(Data storage self) internal view returns (bool) {
        (, uint32 _processingEndTime) = getProcessingWindow(self);

        return block.timestamp >= _processingEndTime;
    }

    function getProcessingWindow(Data storage self) internal view returns (uint32, uint32) {
        (uint32 requiredDelayTime, uint32 requiredWindowTime) = Pool
            .loadExisting(self.poolId)
            .getRequiredDelegationDelayAndWindow(self.deltaCollateralAmountD18 < 0);

        // Apply default (forever) window time if not set
        if (requiredWindowTime == 0) {
            requiredWindowTime = 86400 * 360; // 1 year
        }

        uint32 _processingStartTime = self.declarationTime + requiredDelayTime;
        uint32 _processingEndTime = _processingStartTime + requiredWindowTime;

        return (_processingStartTime, _processingEndTime);
    }
}
