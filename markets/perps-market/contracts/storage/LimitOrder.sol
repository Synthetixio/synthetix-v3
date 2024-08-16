//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Position} from "./Position.sol";
import {MarketUpdate} from "./MarketUpdate.sol";

library LimitOrder {
    /**
     * @notice Gets thrown when a limit order is not on the right nonce
     */
    error LimitOrderInvalidNonce(uint128 accountId, uint256 invalidNonce, uint256 validNonce);

    bytes32 private constant _SLOT_LIMIT_ORDER =
        keccak256(abi.encode("io.synthetix.perps-market.LimitOrder"));

    struct Data {
        /**
         * @dev a mapping of account ids to their current order nonces which increment one at a time.
         */
        mapping(uint128 => mapping(uint256 => uint256)) limitOrderNonceBitmaps;
    }

    /**
     * @notice Limit Order structured data.
     */
    struct SignedOrderRequest {
        /**
         * @dev Limit order account id.
         */
        uint128 accountId;
        /**
         * @dev Limit order market id.
         */
        uint128 marketId;
        /**
         * @dev Limit order relayer address.
         */
        address relayer;
        /**
         * @dev Limit order amount.
         */
        int128 amount;
        /**
         * @dev Limit order price.
         */
        uint256 price;
        /**
         * @dev Is the account a maker?
         */
        bool limitOrderMaker;
        /**
         * @dev Limit order expiration.
         */
        uint256 expiration;
        /**
         * @dev Limit order nonce.
         */
        uint256 nonce;
        /**
         * @dev An optional code provided by frontends to assist with tracking the source of volume and fees.
         */
        bytes32 trackingCode;
    }

    /**
     * @notice Limit Order signature struct.
     */
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /**
     * @dev Struct used internally in validateRequest() to prevent stack too deep error.
     */
    struct ValidateRequestRuntime {
        bool isEligible;
        int128 amount;
        uint128 accountId;
        uint128 marketId;
        uint256 price;
        uint256 limitOrderFees;
        int128 newPositionSize;
        int256 currentAvailableMargin;
        uint256 requiredInitialMargin;
        uint256 totalRequiredMargin;
        Position.Data newPosition;
    }

    /**
     * @dev Struct used internally in settleRequest() to prevent stack too deep error.
     */
    struct SettleRequestRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 amount;
        int256 pnl;
        MarketUpdate.Data updateData;
        uint256 chargedInterest;
        Position.Data newPosition;
        Position.Data oldPosition;
        uint256 relayerFees;
        uint256 feeCollectorFees;
        int256 accruedFunding;
        uint256 limitOrderFees;
        uint256 price;
        int256 chargedAmount;
    }

    function load() internal pure returns (Data storage limitOrderNonces) {
        bytes32 s = _SLOT_LIMIT_ORDER;
        assembly {
            limitOrderNonces.slot := s
        }
    }

    /**
     * @dev Checks if a limit order nonce has been used by a given account.
     * @param self The Data storage struct.
     * @param accountId The account ID to check.
     * @param nonce The limit order nonce to check.
     * @return bool true if the nonce has been used, false otherwise.
     */
    function isLimitOrderNonceUsed(
        Data storage self,
        uint128 accountId,
        uint256 nonce
    ) internal view returns (bool) {
        uint256 slot = nonce / 256; // Determine the bitmap slot
        uint256 bit = nonce % 256; // Determine the bit position within the slot
        return (self.limitOrderNonceBitmaps[accountId][slot] & (1 << bit)) != 0;
    }

    /**
     * @dev Marks a limit order nonce as used for a given account.
     * @param self The Data storage struct.
     * @param accountId The account ID to mark the nonce for.
     * @param nonce The nonce to mark as used.
     */
    function markLimitOrderNonceUsed(Data storage self, uint128 accountId, uint256 nonce) internal {
        uint256 slot = nonce / 256;
        uint256 bit = nonce % 256;
        self.limitOrderNonceBitmaps[accountId][slot] |= 1 << bit;
    }
}
